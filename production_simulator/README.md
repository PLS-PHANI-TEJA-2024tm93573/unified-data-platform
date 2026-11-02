# Production Simulator

Standalone beverage line simulator and OEE calculator with a basic simulator control UI. It publishes machine measurements and production events to NATS and exposes HTTP APIs for a separate dashboard. It is not a full production dashboard, production control system, or Asset Model Service. It never creates or changes hierarchy metadata and never writes directly to a time-series database.

The service simulates `ProductionLine01`, `Station01`, `Mixer_01`, `Boiler_Hub`, `Boiler_01`, `Boiler_02`, `Pump_0`, and `Packager`. OEE is enabled for `Packager` and `ProductionLine01`; line OEE uses final Packager output and line schedule, not an average of machine scores. Open `http://localhost:8090/` for the control UI: start, pause, resume, stop or reset a run, choose a scenario, change settings, view OEE and machine states, and plot recent numeric readings returned by Data Service. The chart polls the Data Service measurements API every 2.5 seconds; choose an asset and variable such as `Mixer_01` → `mixing_speed`. It requires Asset Model metadata mode and a reachable Data Service, not the synthetic fixture.

## Run locally

Requires Node.js 20+ and the repository NATS broker. From the repository root, start the existing broker with `docker compose up -d nats`, then:

```sh
cd production_simulator
npm install
npm start
```

The default metadata mode is `fixture`, clearly labeled as demo data. For real IDs, set `METADATA_MODE=asset-model` and `ASSET_MODEL_URL=http://localhost:3000`; the simulator reads `GET /assets` and `GET /assets/{id}/variables`. The matching hierarchy and variables must already exist. It does not mutate metadata.

Start a run with `curl -X POST http://localhost:8090/api/v1/simulation/start`. Check status and OEE at `/api/v1/simulation/status` and `/api/v1/oee/Packager/current-shift`. See [API reference](docs/api-reference.md). Use `nats sub '>'` with the NATS CLI to inspect all subjects; `industrial.measurements` is also consumed by the existing Data Service.

Docker: build with `docker build -t production-simulator production_simulator`, then run on the existing `data-platform-net` with `-e NATS_URL=nats://unified-data-platform-nats:4222 -p 8090:8090 production-simulator`. The root Compose file also has a service entry using its existing NATS broker. No second broker or database is added.

## Key configuration

Environment values are documented in [configuration](docs/configuration.md). Defaults use a one second tick, 1x virtual time, deterministic seed 42, 60 bottles/minute, 8 hour shift, 30 minute planned break, and 2% reject probability. `AUTO_START=true` starts on process boot. Configuration changes are rejected while running.

## Verify OEE

`known-oee-demo` is a deterministic no-fault/no-reject profile. Set it before start with `POST /api/v1/simulation/scenario` and body `{"scenarioId":"known-oee-demo"}`. Counters follow `total = good + rejected`; OEE is computed from schedule, qualifying Packager fault intervals, generated counter deltas, and configured ideal rate. Empty windows return null component values. Formula and limitations are in [OEE calculation](docs/oee-calculation.md).

## Docs

- [Architecture](docs/architecture.md)
- [API reference](docs/api-reference.md)
- [NATS topics](docs/nats-topics.md)
- [Simulation model](docs/simulation-model.md)
- [OEE calculation](docs/oee-calculation.md)
- [Configuration](docs/configuration.md)
- [Development and testing](docs/development-and-testing.md)

## Limitations

Core NATS has at-most-best-effort delivery from this publisher: disconnected publishes are counted and dropped; the simulator does not claim durable delivery. The demo fixture IDs are synthetic and must not be used as production metadata. Real metadata refresh requires a process restart. Batch routing is simplified to Mixer → Boiler_01 → Pump → Packager, while Boiler_02 remains available/idle. The current generated batch ID is illustrative, not a material genealogy record.
