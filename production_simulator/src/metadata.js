const names = [
  ['ProductionLine01', 'PRODUCTION_LINE'], ['Station01', 'PRODUCTION_STATION'],
  ['Mixer_01', 'MIXER'], ['Boiler_Hub', 'BOILER_HUB'], ['Boiler_01', 'BOILER'],
  ['Boiler_02', 'BOILER'], ['Pump_0', 'PUMP'], ['Packager', 'PACKAGER'],
];
const signals = {
  ProductionLine01: ['line_status', 'total_good_bottles', 'total_rejected_bottles', 'total_bottles'],
  Station01: ['station_status', 'active_equipment_count'],
  Mixer_01: ['machine_status', 'time_running', 'ingredient_weight', 'mixing_speed', 'batch_count', 'batch_rejected_count', 'actual_cycle_time', 'batch_id'],
  Boiler_Hub: ['hub_status', 'active_boiler_count', 'available_boiler_count'],
  Boiler_01: ['machine_status', 'time_running', 'temperature', 'target_temperature', 'pressure', 'target_pressure', 'heating_cycle_count', 'rejected_batch_count', 'actual_heating_cycle_time', 'batch_id', 'heating_cycle_active'],
  Boiler_02: ['machine_status', 'time_running', 'temperature', 'target_temperature', 'pressure', 'target_pressure', 'heating_cycle_count', 'rejected_batch_count', 'actual_heating_cycle_time', 'batch_id', 'heating_cycle_active'],
  Pump_0: ['machine_status', 'time_running', 'volume_pumped', 'flow_rate', 'target_flow_rate', 'transfer_cycle_count', 'rejected_transfer_count', 'actual_transfer_cycle_time', 'batch_id'],
  Packager: ['machine_status', 'time_running', 'total_bottles', 'good_bottles', 'rejected_bottles', 'production_speed', 'bottle_fill_level', 'target_fill_level', 'jam_count', 'batch_id'],
};

// Stable UUID-shaped IDs make the fixture useful for local publishing only.
// They are intentionally not platform asset/AssetVariable IDs.
function fixtureMetadata() {
  return names.map(([name, type], ai) => ({
    id: `00000000-0000-4000-8000-${String(ai + 1).padStart(12, '0')}`,
    name, assetType: { name: type },
    variables: signals[name].map((signal, vi) => ({
      id: `10000000-0000-4000-8000-${String((ai + 1) * 100 + vi + 1).padStart(12, '0')}`,
      name: signal, dataType: typeOf(signal), unit: unitOf(signal),
    })),
  }));
}
function typeOf(n) { return n.includes('status') || n === 'batch_id' ? 'STRING' : n === 'heating_cycle_active' ? 'BOOLEAN' : /count|bottles|active_boiler|available_boiler|jam_count/.test(n) ? 'INTEGER' : 'FLOAT'; }
function unitOf(n) { return ({ temperature: '°C', target_temperature: '°C', pressure: 'psi', target_pressure: 'psi', ingredient_weight: 'g', mixing_speed: 'rpm', time_running: 's', actual_cycle_time: 's/batch', actual_heating_cycle_time: 's/cycle', volume_pumped: 'L', flow_rate: 'L/min', target_flow_rate: 'L/min', actual_transfer_cycle_time: 's/transfer', production_speed: 'bottles/min', bottle_fill_level: 'mL', target_fill_level: 'mL' })[n] || '-'; }

async function loadMetadata() {
  const mode = (process.env.METADATA_MODE || 'fixture').toLowerCase();
  if (mode === 'fixture') return { assets: fixtureMetadata(), source: 'development fixture', fixture: true, diagnostics: [] };
  if (mode !== 'asset-model') throw new Error('METADATA_MODE must be fixture or asset-model');
  const base = (process.env.ASSET_MODEL_URL || 'http://localhost:3000').replace(/\/$/, '');
  const response = await fetch(`${base}/assets`);
  if (!response.ok) throw new Error(`Asset Model GET /assets returned ${response.status}`);
  const rows = await response.json();
  const found = [];
  for (const [name] of names) {
    const asset = rows.find((a) => a.name === name);
    if (!asset) continue;
    const varsResponse = await fetch(`${base}/assets/${encodeURIComponent(asset.id)}/variables`);
    if (!varsResponse.ok) throw new Error(`Asset Model variables for ${name} returned ${varsResponse.status}`);
    const assigned = await varsResponse.json();
    found.push({ id: asset.id, name, assetType: asset.assetType, variables: assigned.map((v) => ({ id: v.id, name: v.variableDefinition?.name, dataType: v.variableDefinition?.dataType, unit: v.variableDefinition?.unit })) });
  }
  const diagnostics = [];
  for (const [name] of names) {
    const asset = found.find((x) => x.name === name);
    if (!asset) { diagnostics.push(`Required asset '${name}' was not found.`); continue; }
    for (const variable of signals[name]) if (!asset.variables.some((x) => x.name === variable && x.id)) diagnostics.push(`Required mapped variable '${variable}' is missing for asset '${name}'.`);
  }
  return { assets: found, source: base, fixture: false, diagnostics };
}
module.exports = { loadMetadata, fixtureMetadata, signals };
