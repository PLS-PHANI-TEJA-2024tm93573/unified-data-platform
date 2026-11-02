const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateOee } = require('../src/oee');
const asset = { id: 'asset-1', name: 'Packager', assetType: { name: 'PACKAGER' } };
const t0 = '2026-01-01T00:00:00.000Z'; const t10 = '2026-01-01T00:10:00.000Z';
function calc(extra = {}) { return calculateOee({ asset, from: t0, to: t10, idealRatePerMinute: 60, plannedIntervals: [{ start: t0, end: t10 }], downtimeIntervals: [], totalCount: 600, goodCount: 588, ...extra }); }

test('calculates all OEE components and product', () => { const x = calc(); assert.equal(x.availabilityPercent, 100); assert.equal(x.performancePercent, 100); assert.equal(x.qualityPercent, 98); assert.equal(x.oeePercent, 98); });
test('clips downtime to the reporting window', () => { const x = calc({ downtimeIntervals: [{ start: '2025-12-31T23:58:00Z', end: '2026-01-01T00:02:00Z' }], totalCount: 480, goodCount: 480 }); assert.equal(x.downtimeSeconds, 120); assert.equal(x.availabilityPercent, 80); });
test('excludes planned breaks and calculates reduced performance', () => { const x = calc({ plannedIntervals: [{ start: t0, end: '2026-01-01T00:08:00Z' }], totalCount: 480, goodCount: 480 }); assert.equal(x.plannedProductionTimeSeconds, 480); assert.equal(x.performancePercent, 100); });
test('returns unavailable values for empty windows and zero counts', () => { const x = calculateOee({ asset, from: t0, to: t0, idealRatePerMinute: 60, plannedIntervals: [], downtimeIntervals: [], totalCount: 0, goodCount: 0 }); assert.equal(x.oeePercent, null); assert.equal(x.availabilityPercent, null); });
test('reports count and range diagnostics rather than clamping', () => { const x = calc({ totalCount: 2, goodCount: 3 }); assert.ok(x.diagnostics.some((d) => d.includes('inconsistent'))); assert.equal(x.oeePercent, null); });
test('performance below ideal rate lowers OEE', () => { const x = calc({ totalCount: 300, goodCount: 300 }); assert.equal(x.performancePercent, 50); assert.equal(x.oeePercent, 50); });
test('rejects an out-of-range component with a diagnostic', () => { const x = calc({ totalCount: 1200, goodCount: 1200 }); assert.ok(x.diagnostics.some((d) => d.includes('performance is outside'))); });
test('zero rejects gives 100% quality', () => { const x = calc({ totalCount: 600, goodCount: 600 }); assert.equal(x.qualityPercent, 100); });
