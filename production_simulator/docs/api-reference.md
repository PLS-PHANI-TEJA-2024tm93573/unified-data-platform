# API reference

Base URL defaults to `http://localhost:8090`. The browser control UI is at `/`. API responses are JSON; OpenAPI JSON is at `/openapi.json` and Swagger UI is at `/api/docs`.

| Method and route | Purpose |
|---|---|
| `GET /health` | Process liveness. |
| `GET /health/ready` | Readiness requires NATS connection and at least one resolved asset. |
| `GET /api/v1/simulation/status` | Lifecycle, run ID, simulation time, speed, metadata source, and NATS health. |
| `POST /api/v1/simulation/start` | Start a new run; idempotent while running. |
| `POST /api/v1/simulation/pause` | Pause; idempotent while not running. |
| `POST /api/v1/simulation/resume` | Resume a paused run. |
| `POST /api/v1/simulation/stop` | Stop and close an open fault interval. |
| `POST /api/v1/simulation/reset` | Clear in-memory counters and run ID; cannot reset while running. |
| `GET /api/v1/simulation/config` | Current configuration. |
| `PUT /api/v1/simulation/config` | Merge configuration fields; only while stopped/paused. |
| `GET /api/v1/scenarios` | List `standard` and `known-oee-demo`. |
| `GET /api/v1/scenarios/{scenarioId}` | Inspect a scenario. |
| `POST /api/v1/simulation/scenario` | Select scenario with `{"scenarioId":"known-oee-demo"}` while stopped or paused. |
| `GET /api/v1/assets` | Resolved IDs, names, and types. |
| `GET /api/v1/assets/{assetId}/variables` | Mapped AssetVariable IDs and variable definition metadata. Accepts fixture names as IDs in fixture mode. |
| `GET /api/v1/simulation/metrics` | State and cumulative counters. |
| `GET /api/v1/oee/{assetId}?from={ISO}&to={ISO}` | Caller-window OEE; defaults to trailing eight hours. |
| `GET /api/v1/oee/{assetId}/current-shift` | OEE for the current shift; currently uses the trailing eight-hour default. |

OEE accepts `Packager`/`ProductionLine01` names in fixture mode or the real asset UUID. Other assets return 422. Invalid JSON/configuration and invalid time ranges return 400 with `{ "error": "..." }`; unknown routes/assets return 404. A range with `to < from` returns 400. Lifecycle misuse returns 400. Health readiness returns 503 when a dependency is unavailable.

Example:

```sh
curl -X POST localhost:8090/api/v1/simulation/start
curl 'localhost:8090/api/v1/oee/Packager?from=2026-11-02T00:00:00Z&to=2026-11-02T01:00:00Z'
```

This service intentionally exposes no telemetry-history route because it does not query a time-series database. OpenAPI currently describes service routes at a basic operation level; this reference documents payload details and lifecycle behavior.
