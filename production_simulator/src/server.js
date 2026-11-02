const http = require('node:http');
const { URL } = require('node:url');
const fs = require('node:fs');
const path = require('node:path');
const { loadMetadata } = require('./metadata');
const { Simulation, DEFAULTS } = require('./engine');
const { NatsPublisher } = require('./publisher');

function json(res, status, body) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(body)); }
async function body(req) { let raw = ''; for await (const chunk of req) raw += chunk; if (!raw) return {}; try { return JSON.parse(raw); } catch { throw new Error('Request body must be valid JSON'); } }
async function main() {
  const dashboardHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const loaded = await loadMetadata(); const assets = Object.fromEntries(loaded.assets.map((a) => [a.name, a]));
  const publisher = new NatsPublisher(); void publisher.start();
  const sim = new Simulation(assets, (subject, payload) => publisher.publish(subject, subject === 'iiot.simulator.v1.status.simulation' ? { ...payload, nats: publisher.health() } : payload));
  const scenarios = [{ id: 'standard', description: 'Seeded beverage line with ordinary variation and occasional faults.' }, { id: 'known-oee-demo', description: 'Repeatable no-reject, no-fault profile at a fixed ideal rate.' }];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); const path = url.pathname;
    try {
      if (req.method === 'GET' && path === '/') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' }); return res.end(dashboardHtml); }
      if (req.method === 'GET' && path === '/health') return json(res, 200, { status: 'ok' });
      if (req.method === 'GET' && path === '/health/ready') { const nats = publisher.health().connected; const metadataReady = loaded.fixture || loaded.diagnostics.length === 0; return json(res, nats && metadataReady ? 200 : 503, { ready: nats && metadataReady, nats, metadata: { source: loaded.source, fixture: loaded.fixture, assetsResolved: loaded.assets.length, diagnostics: loaded.diagnostics } }); }
      if (req.method === 'GET' && path === '/api/v1/simulation/status') return json(res, 200, { ...sim.status(), nats: publisher.health(), metadata: { source: loaded.source, fixture: loaded.fixture, diagnostics: loaded.diagnostics } });
      if (req.method === 'POST' && path === '/api/v1/simulation/start') return json(res, 200, sim.start());
      if (req.method === 'POST' && path === '/api/v1/simulation/pause') return json(res, 200, sim.pause());
      if (req.method === 'POST' && path === '/api/v1/simulation/resume') return json(res, 200, sim.resume());
      if (req.method === 'POST' && path === '/api/v1/simulation/stop') return json(res, 200, sim.stop());
      if (req.method === 'POST' && path === '/api/v1/simulation/reset') { sim.reset(); return json(res, 200, sim.status()); }
      if (req.method === 'GET' && path === '/api/v1/simulation/config') return json(res, 200, sim.config);
      if (req.method === 'PUT' && path === '/api/v1/simulation/config') return json(res, 200, sim.setConfig(await body(req)));
      if (req.method === 'GET' && path === '/api/v1/scenarios') return json(res, 200, scenarios);
      if (req.method === 'GET' && path.startsWith('/api/v1/scenarios/')) { const item = scenarios.find((s) => s.id === decodeURIComponent(path.split('/').pop())); return item ? json(res, 200, item) : json(res, 404, { error: 'Scenario not found' }); }
      if (req.method === 'POST' && path === '/api/v1/simulation/scenario') return json(res, 200, sim.setScenario((await body(req)).scenarioId));
      if (req.method === 'GET' && path === '/api/v1/assets') return json(res, 200, loaded.assets.map(({ id, name, assetType }) => ({ id, name, assetType })));
      if (req.method === 'GET' && path === '/api/v1/simulation/metrics') return json(res, 200, { ...sim.metrics(), nats: publisher.health() });
      if (req.method === 'GET' && path.startsWith('/api/v1/assets/') && path.endsWith('/variables')) { const id = decodeURIComponent(path.split('/')[4]); const asset = loaded.assets.find((a) => a.id === id || a.name === id); return asset ? json(res, 200, asset.variables) : json(res, 404, { error: 'Asset not found' }); }
      if (req.method === 'GET' && path.startsWith('/api/v1/oee/')) {
        const bits = path.split('/'); const id = decodeURIComponent(bits[4]); const asset = loaded.assets.find((a) => a.id === id || a.name === id);
        if (!asset) return json(res, 404, { error: 'Asset not found' });
        if (!['Packager', 'ProductionLine01'].includes(asset.name)) return json(res, 422, { error: 'OEE is enabled only for Packager and ProductionLine01' });
        const to = url.searchParams.get('to') || sim.now?.toISOString() || new Date().toISOString(); const from = url.searchParams.get('from') || (path.endsWith('/current-shift') && sim.currentShiftStart() ? sim.currentShiftStart().toISOString() : new Date(new Date(to).getTime() - 8 * 3600000).toISOString());
        return json(res, 200, sim.oee(asset, from, to));
      }
      if (req.method === 'GET' && path === '/openapi.json') return json(res, 200, openapi);
      if (req.method === 'GET' && path === '/api/docs') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end('<!doctype html><html><head><title>Production Simulator API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:"/openapi.json",dom_id:"#swagger-ui"})</script></body></html>'); }
      return json(res, 404, { error: 'Not found' });
    } catch (error) { return json(res, 400, { error: error.message }); }
  });
  const port = Number(process.env.PORT || 8090); for (const diagnostic of loaded.diagnostics) console.error(`Asset metadata: ${diagnostic}`); server.listen(port, () => console.log(`Production Simulator listening on :${port}; metadata=${loaded.source}`));
  if (process.env.AUTO_START === 'true') sim.start();
  const shutdown = async () => { sim.stop(); server.close(); await publisher.close(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
const ok = { '200': { description: 'Success' }, '400': { description: 'Invalid request' }, '404': { description: 'Not found' } };
const operation = (summary, method = 'get') => ({ [method]: { summary, responses: ok } });
const openapi = { openapi: '3.0.3', info: { title: 'Production Simulator API', version: '1.0.0' }, paths: {
  '/health': operation('Liveness'), '/health/ready': operation('Readiness'),
  '/api/v1/simulation/status': operation('Read simulation status'),
  '/api/v1/simulation/start': operation('Start simulation', 'post'), '/api/v1/simulation/pause': operation('Pause simulation', 'post'), '/api/v1/simulation/resume': operation('Resume simulation', 'post'), '/api/v1/simulation/stop': operation('Stop simulation', 'post'), '/api/v1/simulation/reset': operation('Reset in-memory run', 'post'),
  '/api/v1/simulation/config': { ...operation('Read configuration'), put: { summary: 'Update configuration', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', example: { speedMultiplier: 5, rejectProbability: 0.02 } } } } }, responses: ok } },
  '/api/v1/scenarios': operation('List scenarios'), '/api/v1/scenarios/{scenarioId}': operation('Get scenario'), '/api/v1/simulation/scenario': { post: { summary: 'Select scenario', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['scenarioId'], properties: { scenarioId: { type: 'string', example: 'known-oee-demo' } } } } } }, responses: ok } },
  '/api/v1/assets': operation('List resolved assets'), '/api/v1/assets/{assetId}/variables': operation('List mapped variables'), '/api/v1/simulation/metrics': operation('Read simulator metrics'), '/api/v1/oee/{assetId}': operation('Calculate OEE for caller time window'), '/api/v1/oee/{assetId}/current-shift': operation('Calculate current shift OEE'),
} };
main().catch((error) => { console.error(`Simulator startup failed: ${error.message}`); process.exit(1); });
