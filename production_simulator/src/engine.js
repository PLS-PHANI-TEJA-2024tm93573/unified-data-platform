const crypto = require('node:crypto');
const { calculateOee } = require('./oee');

const DEFAULTS = {
  tickIntervalMs: Number(process.env.SIM_TICK_MS || 1000), speedMultiplier: Number(process.env.SIM_SPEED || 1), seed: Number(process.env.SIM_SEED || 42),
  idealRatePerMinute: 60, shiftMinutes: 480, plannedBreakMinutes: 30, rejectProbability: 0.02, speedMinFactor: 0.9, speedMaxFactor: 1,
  defectDistribution: { underfill: 0.25, overfill: 0.25, cap_failure: 0.25, label_failure: 0.25 },
  setupCountsAsDowntime: true, faultProbabilityPerTick: 0.001, jamProbabilityPerTick: 0.0005, publishIntervalTicks: Number(process.env.PUBLISH_INTERVAL_TICKS || 1),
};
const MODES = ['underfill', 'overfill', 'cap_failure', 'label_failure'];
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
class Simulation {
  constructor(assets, emit, config = {}) { this.assets = assets; this.emit = emit; this.config = { ...DEFAULTS, ...config }; this.state = 'stopped'; this.runId = null; this.scenarioId = null; this.tickCount = 0; this.now = null; this.events = []; this.downtime = []; this.currentFault = null; this.random = seeded(this.config.seed); this.timer = null; this.reset(); }
  reset() { if (this.state === 'running') throw new Error('Stop the simulation before reset'); const previousRunId = this.runId; this.state = 'stopped'; this.runId = null; this.tickCount = 0; this.now = null; this.events = []; this.downtime = []; this.samples = []; this.currentFault = null; this.currentJam = null; this.accumulator = 0; this.counters = { total: 0, good: 0, rejected: 0, jams: 0, batch: 0, transfers: 0, cycles: 0, runningSeconds: 0 }; this.machine = { Mixer_01: 'IDLE', Boiler_01: 'IDLE', Boiler_02: 'IDLE', Pump_0: 'IDLE', Packager: 'IDLE' }; this.rng = seeded(this.config.seed); this.random = this.rng; this.publish('iiot.simulator.v1.status.simulation', { ...this.status(), event: 'reset', previousSimulationRunId: previousRunId, timestamp: new Date().toISOString() }); }
  start() { if (this.state === 'running') return this.status(); if (this.state === 'paused') throw new Error('Use resume while paused'); if (this.runId) this.reset(); this.runId = crypto.randomUUID(); this.state = 'running'; this.now = new Date(); this.shiftStart = new Date(this.now); this.scheduleTimer(); this.transition('Mixer_01', 'RUNNING'); this.transition('Boiler_01', 'HEATING'); this.transition('Pump_0', 'IDLE'); this.transition('Packager', 'RUNNING'); return this.status(); }
  scheduleTimer() { clearInterval(this.timer); this.timer = setInterval(() => this.tick(), this.config.tickIntervalMs); this.timer.unref?.(); }
  pause() { if (this.state !== 'running') return this.status(); clearInterval(this.timer); this.state = 'paused'; this.publish('iiot.simulator.v1.status.simulation', this.status()); return this.status(); }
  resume() { if (this.state === 'running') return this.status(); if (this.state !== 'paused') throw new Error('Simulation is not paused'); this.state = 'running'; this.scheduleTimer(); this.publish('iiot.simulator.v1.status.simulation', this.status()); return this.status(); }
  stop() { clearInterval(this.timer); if (this.currentFault) this.closeFault(); if (this.currentJam) this.closeJam(); this.state = 'stopped'; this.publish('iiot.simulator.v1.status.simulation', this.status()); return this.status(); }
  status() { return { state: this.state, simulationRunId: this.runId, scenarioId: this.scenarioId, simulationTime: this.now?.toISOString() || null, speedMultiplier: this.config.speedMultiplier, tickIntervalMs: this.config.tickIntervalMs, tickCount: this.tickCount }; }
  setConfig(next) { if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Configuration must be a JSON object'); if (this.state === 'running') throw new Error('Configuration cannot be changed while running; pause or stop first'); const allowed = Object.keys(DEFAULTS); if (Object.keys(next).some((key) => !allowed.includes(key))) throw new Error('Configuration contains an unsupported property'); const merged = { ...this.config, ...next }; const finite = (key) => typeof merged[key] === 'number' && Number.isFinite(merged[key]); const distribution = merged.defectDistribution; const weightsValid = distribution && typeof distribution === 'object' && Object.keys(distribution).length === 4 && MODES.every((name) => typeof distribution[name] === 'number' && Number.isFinite(distribution[name]) && distribution[name] >= 0) && Object.values(distribution).reduce((a, b) => a + b, 0) > 0; if (!finite('speedMultiplier') || merged.speedMultiplier <= 0 || !finite('tickIntervalMs') || merged.tickIntervalMs < 50 || !Number.isInteger(merged.tickIntervalMs) || !finite('idealRatePerMinute') || merged.idealRatePerMinute <= 0 || !finite('shiftMinutes') || merged.shiftMinutes <= 0 || !finite('plannedBreakMinutes') || merged.plannedBreakMinutes < 0 || merged.plannedBreakMinutes >= merged.shiftMinutes || !finite('rejectProbability') || merged.rejectProbability < 0 || merged.rejectProbability > 1 || !finite('faultProbabilityPerTick') || merged.faultProbabilityPerTick < 0 || merged.faultProbabilityPerTick > 1 || !finite('jamProbabilityPerTick') || merged.jamProbabilityPerTick < 0 || merged.jamProbabilityPerTick > 1 || !finite('speedMinFactor') || !finite('speedMaxFactor') || merged.speedMinFactor <= 0 || merged.speedMaxFactor < merged.speedMinFactor || merged.speedMaxFactor > 1 || !weightsValid || !finite('seed') || !Number.isInteger(merged.seed) || !finite('publishIntervalTicks') || merged.publishIntervalTicks < 1 || !Number.isInteger(merged.publishIntervalTicks) || typeof merged.setupCountsAsDowntime !== 'boolean') throw new Error('Invalid configuration values'); this.config = merged; this.random = seeded(merged.seed); return this.config; }
  setScenario(id) { if (this.state === 'running') throw new Error('Pause or stop before changing scenario'); if (id !== 'standard' && id !== 'known-oee-demo') throw new Error('Unknown scenario'); this.scenarioId = id; if (id === 'known-oee-demo') this.setConfig({ seed: 7, rejectProbability: 0, faultProbabilityPerTick: 0, jamProbabilityPerTick: 0, speedMinFactor: 1, speedMaxFactor: 1, idealRatePerMinute: 60 }); else this.setConfig(DEFAULTS); return { scenarioId: id, config: this.config }; }
  tick() {
    if (this.state !== 'running') return;
    const dt = this.config.tickIntervalMs * this.config.speedMultiplier / 1000; this.now = new Date(this.now.getTime() + dt * 1000); this.tickCount++;
    if (this.random() < this.config.faultProbabilityPerTick && !this.currentFault && !this.currentJam) this.openFault();
    else if (this.currentFault && this.random() < 0.08) this.closeFault();
    if (this.currentJam && this.now.getTime() >= this.currentJam.until) this.closeJam();
    const active = !this.currentFault && !this.currentJam && !this.isBreak();
    const inactiveState = this.currentFault ? 'FAULTED' : this.currentJam ? 'STOPPED' : 'IDLE';
    this.transition('Mixer_01', active ? 'RUNNING' : inactiveState);
    this.transition('Boiler_01', active ? 'HEATING' : inactiveState);
    this.transition('Boiler_02', 'IDLE'); this.transition('Pump_0', active ? 'RUNNING' : inactiveState);
    this.transition('Packager', active ? 'RUNNING' : inactiveState);
    if (active) {
      this.counters.runningSeconds += dt; this.counters.batch += dt / 120; this.counters.cycles += dt / 180; this.counters.transfers += dt / 90;
      const speed = this.config.idealRatePerMinute * (this.config.speedMinFactor + this.random() * (this.config.speedMaxFactor - this.config.speedMinFactor)); this.accumulator = (this.accumulator || 0) + speed * dt / 60;
      const made = Math.floor(this.accumulator); this.accumulator -= made;
      for (let i = 0; i < made; i++) { this.counters.total++; const defect = this.random() < this.config.rejectProbability; if (defect) this.counters.rejected++; else this.counters.good++; if (this.assets.Packager) this.event('iiot.simulator.v1.events.quality', 'Packager', { decision: defect ? 'REJECT' : 'ACCEPT', defectReason: defect ? this.pickDefect() : null, unitNumber: this.counters.total }); }
      if (this.random() < this.config.jamProbabilityPerTick) this.openJam();
      this.telemetry(speed);
      if (this.tickCount % this.config.publishIntervalTicks === 0) this.publishProduction();
    }
    this.samples.push({ timestamp: this.now.toISOString(), total: this.counters.total, good: this.counters.good });
    if (this.samples.length > 100000) this.samples.splice(0, this.samples.length - 100000);
    this.publishOee();
  }
  isBreak() { const elapsed = ((this.now - this.shiftStart) / 60000) % this.config.shiftMinutes; return elapsed >= this.config.shiftMinutes - this.config.plannedBreakMinutes; }
  currentShiftStart() { if (!this.now || !this.shiftStart) return null; const shiftMs = this.config.shiftMinutes * 60000; return new Date(this.shiftStart.getTime() + Math.floor((this.now.getTime() - this.shiftStart.getTime()) / shiftMs) * shiftMs); }
  transition(assetName, state) { if (this.machine[assetName] === state) return; const previous = this.machine[assetName]; this.machine[assetName] = state; this.event('iiot.simulator.v1.events.machine-state', assetName, { previousState: previous, state }); }
  openFault() { this.currentFault = { start: this.now.toISOString(), asset: 'Packager' }; this.transition('Packager', 'FAULTED'); this.event('iiot.simulator.v1.events.downtime', 'Packager', { event: 'start', reason: 'unplanned_fault', start: this.currentFault.start }); }
  closeFault() { const interval = { assetName: this.currentFault.asset, start: this.currentFault.start, end: this.now.toISOString() }; this.downtime.push(interval); if (this.downtime.length > 10000) this.downtime.shift(); this.event('iiot.simulator.v1.events.downtime', 'Packager', { event: 'end', reason: 'unplanned_fault', ...interval }); this.currentFault = null; }
  openJam() { this.counters.jams++; this.currentJam = { start: this.now.toISOString(), until: this.now.getTime() + 5000 }; this.event('iiot.simulator.v1.events.downtime', 'Packager', { event: 'start', reason: 'jam', start: this.currentJam.start, durationSeconds: 5 }); }
  pickDefect() { const entries = Object.entries(this.config.defectDistribution); const total = entries.reduce((sum, [, weight]) => sum + weight, 0); let point = this.random() * total; for (const [name, weight] of entries) { point -= weight; if (point <= 0) return name; } return entries.at(-1)[0]; }
  closeJam() { const interval = { assetName: 'Packager', start: this.currentJam.start, end: this.now.toISOString() }; this.downtime.push(interval); if (this.downtime.length > 10000) this.downtime.shift(); this.event('iiot.simulator.v1.events.downtime', 'Packager', { event: 'end', reason: 'jam', ...interval }); this.currentJam = null; }
  event(topic, assetName, fields) { const asset = this.assets[assetName]; const msg = { schemaVersion: '1.0', eventId: crypto.randomUUID(), simulationRunId: this.runId, assetId: asset?.id || null, assetName, timestamp: this.now.toISOString(), ...fields }; this.publish(`${topic}.${assetToken(asset?.id || assetName)}`, msg); }
  publish(topic, payload) { void this.emit(topic, payload); }
  measurement(assetName, name, value) { const asset = this.assets[assetName]; const variable = asset?.variables?.find((v) => v.name === name); if (!variable) return; const message = { variable_id: variable.id, timestamp: this.now.toISOString(), value }; this.publish('industrial.measurements', message); this.publish(`iiot.simulator.v1.telemetry.${(asset.assetType?.name || 'asset').toLowerCase()}.${assetToken(asset.id)}`, { schemaVersion: '1.0', eventId: crypto.randomUUID(), simulationRunId: this.runId, assetId: asset.id, assetName, variableId: variable.id, variableName: name, unit: variable.unit, timestamp: this.now.toISOString(), value }); }
  telemetry(speed) {
    const sec = this.counters.runningSeconds; const status = (n) => this.machine[n] || 'IDLE';
    const values = {
      ProductionLine01: { line_status: status('Packager'), total_good_bottles: this.counters.good, total_rejected_bottles: this.counters.rejected, total_bottles: this.counters.total },
      Station01: { station_status: status('Packager'), active_equipment_count: Object.values(this.machine).filter((s) => s === 'RUNNING' || s === 'HEATING').length },
      Mixer_01: { machine_status: status('Mixer_01'), time_running: sec, ingredient_weight: 1250 + this.random() * 50, mixing_speed: 900 + this.random() * 80, batch_count: Math.floor(this.counters.batch), batch_rejected_count: 0, actual_cycle_time: 120, batch_id: `batch-${Math.floor(this.counters.batch)}` },
      Boiler_Hub: { hub_status: 'RUNNING', active_boiler_count: this.machine.Boiler_01 === 'HEATING' ? 1 : 0, available_boiler_count: 2 },
      Boiler_01: { machine_status: status('Boiler_01'), time_running: sec, temperature: 84 + Math.sin(sec / 60) * 5, target_temperature: 85, pressure: 30 + Math.sin(sec / 45), target_pressure: 30, heating_cycle_count: Math.floor(this.counters.cycles), rejected_batch_count: 0, actual_heating_cycle_time: 180, batch_id: `batch-${Math.floor(this.counters.batch)}`, heating_cycle_active: status('Boiler_01') === 'HEATING' },
      Boiler_02: { machine_status: status('Boiler_02'), time_running: 0, temperature: 25 + Math.sin(sec / 90), target_temperature: 85, pressure: 14.7, target_pressure: 30, heating_cycle_count: 0, rejected_batch_count: 0, actual_heating_cycle_time: 0, batch_id: '', heating_cycle_active: false },
      Pump_0: { machine_status: status('Pump_0'), time_running: sec, volume_pumped: sec * 0.5, flow_rate: 30 + this.random() * 5, target_flow_rate: 32, transfer_cycle_count: Math.floor(this.counters.transfers), rejected_transfer_count: 0, actual_transfer_cycle_time: 90, batch_id: `batch-${Math.floor(this.counters.batch)}` },
      Packager: { machine_status: status('Packager'), time_running: sec, total_bottles: this.counters.total, good_bottles: this.counters.good, rejected_bottles: this.counters.rejected, production_speed: speed, bottle_fill_level: 500 + (this.random() - 0.5) * 6, target_fill_level: 500, jam_count: this.counters.jams, batch_id: `batch-${Math.floor(this.counters.batch)}` },
    };
    for (const [asset, vars] of Object.entries(values)) for (const [name, value] of Object.entries(vars)) this.measurement(asset, name, value);
  }
  publishProduction() { const asset = this.assets.Packager; if (asset) this.event('iiot.simulator.v1.events.production', 'Packager', { totalCount: this.counters.total, goodCount: this.counters.good, rejectedCount: this.counters.rejected, batchId: `batch-${Math.floor(this.counters.batch)}` }); }
  plannedIntervals(from, to) {
    const start = new Date(from).getTime(), end = new Date(to).getTime();
    const first = this.shiftStart?.getTime() || start; const shiftMs = this.config.shiftMinutes * 60000; const plannedMs = Math.max(0, this.config.shiftMinutes - this.config.plannedBreakMinutes) * 60000; const result = [];
    for (let base = first + Math.floor((start - first) / shiftMs) * shiftMs; base < end; base += shiftMs) { const a = Math.max(start, base), b = Math.min(end, base + plannedMs); if (b > a) result.push({ start: new Date(a).toISOString(), end: new Date(b).toISOString() }); }
    return result;
  }
  oee(asset, from, to) {
    const lower = new Date(from).getTime(), upper = new Date(to).getTime();
    const at = (time) => { let result = { total: 0, good: 0 }; for (const sample of this.samples) if (new Date(sample.timestamp).getTime() <= time) result = sample; return result; };
    const baseline = at(lower), final = at(upper); const totalCount = final.total - baseline.total; const goodCount = final.good - baseline.good;
    const faults = this.downtime.filter((d) => d.assetName === 'Packager'); if (this.currentFault && asset.name === 'Packager') faults.push({ start: this.currentFault.start }); if (this.currentJam && asset.name === 'Packager') faults.push({ start: this.currentJam.start });
    return calculateOee({ asset, from, to, idealRatePerMinute: this.config.idealRatePerMinute, plannedIntervals: this.plannedIntervals(from, to), downtimeIntervals: faults, totalCount, goodCount, calculatedAt: new Date().toISOString(), simulationRunId: this.runId, scenarioId: this.scenarioId });
  }
  publishOee() { for (const name of ['Packager', 'ProductionLine01']) { const asset = this.assets[name]; if (asset) this.publish(`iiot.simulator.v1.kpi.oee.${assetToken(asset.id)}`, { schemaVersion: '1.0', eventId: crypto.randomUUID(), simulationRunId: this.runId, timestamp: this.now.toISOString(), ...this.oee(asset, this.currentShiftStart().toISOString(), this.now.toISOString()) }); } }
  metrics() { return { ...this.status(), states: this.machine, counters: this.counters, lastSimulationTimestamp: this.now?.toISOString() || null }; }
}
function assetToken(value) { return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown'; }
module.exports = { Simulation, DEFAULTS, assetToken };
