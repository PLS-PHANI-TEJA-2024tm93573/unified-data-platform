# Development and testing

Project structure: `src/engine.js` owns lifecycle and simulation, `src/oee.js` computes metrics, `src/metadata.js` resolves demo/Asset Model mappings, `src/publisher.js` sends Core NATS messages, and `src/server.js` exposes HTTP endpoints.

```sh
npm install
npm test
npm start
```

Tests use Node's built-in test runner and do not require a broker or database. Run the repository broker with `docker compose up -d nats`; then inspect traffic using `nats sub '>'` or a NATS GUI. Start the simulator over HTTP after confirming `/health/ready`.

Add equipment by extending metadata signal names/units/types, the engine's transition and tick model, and telemetry mappings; update the API and NATS catalogue in the same change. Add tests with deterministic seeds and fake emitters. Major contract changes need a new NATS subject version; additive fields may remain in v1. An integration test against a disposable/live NATS broker and full API lifecycle tests are still recommended; the current automated suite focuses on deterministic engine and OEE behavior.
