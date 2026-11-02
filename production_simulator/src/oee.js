function calculateOee({ asset, from, to, idealRatePerMinute, plannedIntervals, downtimeIntervals, totalCount, goodCount, calculatedAt = new Date().toISOString(), simulationRunId, scenarioId }) {
  const start = new Date(from).getTime(); const end = new Date(to).getTime();
  const diagnostics = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) throw new Error('from/to must be valid timestamps with to >= from');
  const overlap = (a, b, c, d) => Math.max(0, Math.min(b, d) - Math.max(a, c));
  const plannedMs = plannedIntervals.reduce((n, x) => n + overlap(start, end, new Date(x.start).getTime(), new Date(x.end).getTime()), 0);
  const downMs = downtimeIntervals.reduce((n, x) => n + overlap(start, end, new Date(x.start).getTime(), new Date(x.end || to).getTime()), 0);
  const plannedSec = plannedMs / 1000; const downtimeSec = downMs / 1000; const operatingSec = Math.max(0, plannedSec - downtimeSec);
  const rejectedCount = totalCount - goodCount;
  if (goodCount < 0 || totalCount < 0 || goodCount > totalCount) diagnostics.push('Counts are inconsistent: require 0 <= goodCount <= totalCount.');
  const availability = plannedSec === 0 ? null : operatingSec / plannedSec;
  const idealOutput = idealRatePerMinute * operatingSec / 60;
  const performance = totalCount === 0 || idealOutput === 0 ? null : totalCount / idealOutput;
  const quality = totalCount === 0 ? null : goodCount / totalCount;
  for (const [label, value] of [['availability', availability], ['performance', performance], ['quality', quality]]) if (value != null && (value < 0 || value > 1)) diagnostics.push(`${label} is outside the valid 0–100% range (${(value * 100).toFixed(2)}%).`);
  const invalid = diagnostics.length > 0;
  return {
    assetId: asset.id, assetName: asset.name, assetType: asset.assetType?.name || asset.assetType || 'UNKNOWN',
    reportingWindowStart: new Date(start).toISOString(), reportingWindowEnd: new Date(end).toISOString(),
    plannedProductionTimeSeconds: plannedSec, operatingTimeSeconds: operatingSec, downtimeSeconds: downtimeSec,
    idealProductionRate: idealRatePerMinute, idealProductionRateUnit: 'bottles/min', totalCount, goodCount, rejectedCount,
    availabilityPercent: invalid || availability == null ? null : availability * 100,
    performancePercent: invalid || performance == null ? null : performance * 100,
    qualityPercent: invalid || quality == null ? null : quality * 100,
    oeePercent: invalid || availability == null || performance == null || quality == null ? null : availability * performance * quality * 100,
    calculatedAt, simulationRunId, ...(scenarioId ? { scenarioId } : {}), diagnostics,
  };
}
module.exports = { calculateOee };
