# Codex Prompt: IIoT Production Simulator Service

You are working in my existing IIoT platform repository in VS Code. Build a standalone **Production Simulator Service** that simulates a beverage manufacturing line, publishes realistic telemetry/events through **NATS**, and calculates OEE for my separately developed dashboard.

Use **GPT-6 with High thinking effort**. Inspect the repository before coding. Follow existing conventions and reuse existing contracts/libraries. Do not guess API routes, schemas, database products, or message formats when they can be discovered.

## 1. Scope

Build only the Production Simulator Service. It must:
- Simulate equipment behaviour and production.
- Generate machine telemetry, cumulative counters, quality outcomes, state changes, production events, and downtime intervals.
- Publish data through NATS.
- Calculate Availability, Performance, Quality, and OEE from generated data.
- Publish OEE snapshots suitable for my dashboard.
- Expose HTTP APIs to start, pause, resume, stop, configure, inspect, and calculate OEE.
- Include detailed documentation, especially a dedicated NATS topics reference.

This is a **data generator and OEE calculator**, not a production control system.

### Explicitly out of scope
Do not build a dashboard/frontend. Do not modify the Asset Model Service, its APIs, PostgreSQL schema, asset hierarchy, Telemetry Ingestion Service, Time-Series Database service, or unrelated platform services. Do not integrate with real PLCs, OPC UA, Modbus, or physical equipment. Do not build predictive maintenance or a general analytics platform.

## 2. Inspect the repository first

Before implementation:
1. Inspect the repository tree and identify service conventions, language/runtime, shared libraries, NATS usage, logging, configuration, API conventions, Docker/Compose, tests, and documentation.
2. Search for existing NATS subjects and message contracts, Asset Model API clients/OpenAPI specs, telemetry schemas, Time-Series DB integrations, and health/OpenAPI conventions.
3. Read relevant README, compose, environment, and service configuration files.
4. Prefer the existing stack. If no applicable convention exists, use **.NET 10 ASP.NET Core** with hosted background services for simulation.
5. Produce a short plan, then implement it. Do not stop at the plan.

Integration rules:
- Reuse existing NATS libraries and contracts where possible.
- Do not invent Asset Model API routes or response shapes. Discover them from code/OpenAPI/config.
- PostgreSQL is authoritative for asset hierarchy and metadata. Treat it as read-only; never create/update/delete hierarchy records.
- Prefer resolving asset metadata through the existing Asset Model API. Do not add direct PostgreSQL access if an existing API client is available.
- Telemetry/events should normally be published to NATS and persisted by the existing ingestion pipeline. Do not write directly to the Time-Series DB unless repository inspection establishes that this is the existing intended integration.
- Do not assume which Time-Series DB product is used.
- Do not add a database just to store simulated telemetry. Keep simulator runtime state in memory initially unless the repository has a clear convention requiring persistence.
- If an external contract is missing, isolate it behind an interface and document required configuration. Do not fabricate an API.
- A local development metadata fixture is acceptable for tests/demo only, clearly labelled as fixture data and never confused with real asset IDs.

## 3. Asset hierarchy to simulate

```text
ProductionLine01 [PRODUCTION_LINE]
└── Station01 [PRODUCTION_STATION]
    ├── Mixer_01 [MIXER]
    ├── Boiler_Hub [BOILER_HUB]
    │   ├── Boiler_01 [BOILER]
    │   └── Boiler_02 [BOILER]
    ├── Pump_0 [PUMP]
    └── Packager [PACKAGER]
```

These assets already exist or will exist in the Asset Model Service. Use their **actual asset IDs** and variable-definition IDs/names. Display names are not IDs. Never duplicate or create the hierarchy in this service.

### Equipment behaviour

**Mixer_01**
- Simulate batch preparation, mixing duration/speed, ingredient weight, batch ID, completion, and batch quality outcome.
- Support running, idle, setup, stopped, and fault states as appropriate.

**Boiler_01 and Boiler_02**
- Simulate heating cycles for batches.
- Generate current/target temperature and pressure with gradual, bounded changes.
- Support heating, ready, idle, fault, and maintenance states.
- Emit cycle-completion and rejected-batch events when configured.
- `Boiler_Hub` is a logical grouping/coordinator, not a production machine. Do not calculate OEE for it by default.

**Pump_0**
- Simulate liquid transfers, flow rate, cumulative volume, transfer-cycle count, state, and batch ID.
- Support running, idle, stopped, and faulted states.

**Packager**
- Primary OEE example; simulate discrete bottle production.
- Generate machine state, total bottles, good bottles, rejected bottles, actual production speed, fill-level measurements, jam/fault events, and defect reasons.
- Use a fractional production accumulator so rates such as 45 bottles/minute work correctly with a one-second tick.
- Generate quality decisions for produced units, or an equivalent efficient approach that preserves exact counts.
- Configurable reject probability and defect categories: underfill, overfill, cap failure, label failure.

**ProductionLine01**
- Represents the line-level production boundary and publishes final output/status.
- Calculate line OEE from line planned production time, ideal rate, total output, and good output. Do not average machine OEE values.
- Initially, final Packager output is line output unless repository/domain configuration establishes otherwise.

**Station01**
- Logical station. Publish derived status only where meaningful; do not invent production counts.

### Batch correlation
Use a shared `batchId` to correlate Mixer → Boiler → Pump → Packager. The initial routing may be simplified (e.g. one selected boiler at a time), but document the simplification and keep it extensible.

## 4. Simulation engine

Build a deterministic, configurable engine:
- Configurable random seed for reproducible runs.
- Configurable tick interval and simulation speed multiplier (e.g. 1x, 5x, 10x).
- Start, pause, resume, stop, and reset.
- Inject a clock/time abstraction where practical so tests do not rely on wall-clock sleeps.
- Clearly distinguish wall-clock timestamps from simulation timestamps.
- UTC timestamps on all emitted records; preserve monotonic simulation time and sensible event ordering.
- Do not block simulation ticks on NATS publishing.
- Graceful cancellation/shutdown.

### Schedule
Provide configurable shifts and planned breaks. Development defaults may be:
- Shift: 8 hours.
- Planned break: 30 minutes.
- Planned Production Time: 450 minutes.
- Packager ideal speed: 60 bottles/minute.

These are demo defaults, not universal values. Expose configuration through app settings and APIs. Planned breaks are excluded from Planned Production Time when configured. Unplanned stops within planned production time count as downtime. Make setup/changeover treatment configurable and document it.

### Machine states
Support, where applicable:
`RUNNING`, `SLOW_RUNNING`, `IDLE`, `STOPPED`, `FAULTED`, `SETUP`, `MAINTENANCE`.

Use explicit state transitions and timestamps. Publish state-change events on transitions, not every tick, unless a configurable heartbeat is needed by an existing contract.

### Realism and invariants
- Vary actual speed within configured bounds.
- Simulate slowdowns, jams, faults, recovery, and planned breaks.
- Simulate temperature, pressure, flow, fill level, and mixing speed with plausible bounded gradual changes.
- Counters are cumulative within a run and never decrease unless an explicit reset event occurs.
- `totalCount = goodCount + rejectedCount` for the same scope/window.
- Do not produce while equipment is stopped/faulted/idle.
- Do not create quality outcomes for units not produced.
- Fault start/end events must form valid intervals.
- Avoid overlapping downtime intervals for one asset unless explicitly modelled.
- Include a deterministic demo scenario that produces a known, testable OEE result.

## 5. OEE calculation

Calculate OEE from simulated states, downtime intervals, production counters/events, and configured ideal rates. **Never generate a random OEE percentage.**

```text
Availability = Operating Time / Planned Production Time
Performance  = (Ideal Production Rate × Operating Time) / Total Count
Quality      = Good Count / Total Count
OEE          = Availability × Performance × Quality
```

Use consistent units. For ideal rate in bottles/minute, operating time must be in minutes. Alternatively use ideal cycle time and seconds consistently.

Rules:
1. Planned Production Time is scheduled production time excluding configured planned breaks.
2. Operating Time = Planned Production Time − qualifying downtime.
3. Downtime is derived from state intervals, clipped to the reporting window and planned production intervals.
4. Configure whether `IDLE`, `STOPPED`, `FAULTED`, `SETUP`, and `MAINTENANCE` count as downtime. Provide sensible defaults and document them.
5. Total, good, and rejected counts must be calculated for the reporting window using counter deltas/events.
6. Ideal rate/cycle time is configuration/master data, never random telemetry.
7. Handle zero-duration windows and zero total count without division-by-zero errors. Return a documented null/unavailable result or zero convention.
8. Enable OEE for Packager and ProductionLine01 initially. Other equipment only when production unit, ideal rate, schedule, and good/total counts are explicitly configured.
9. Never calculate OEE for Boiler_Hub or Station01 by default.
10. Never average equipment OEE to obtain line OEE.
11. OEE components should be 0–100%. Detect inconsistent data that would produce invalid values; report diagnostics rather than silently clamping.
12. Support current shift, previous shift, hourly, and caller-specified time ranges.

OEE result fields:
- `assetId`, `assetName`, `assetType`
- `reportingWindowStart`, `reportingWindowEnd`
- `plannedProductionTimeSeconds`, `operatingTimeSeconds`, `downtimeSeconds`
- `idealProductionRate` plus unit, or ideal cycle time plus unit
- `totalCount`, `goodCount`, `rejectedCount`
- `availabilityPercent`, `performancePercent`, `qualityPercent`, `oeePercent`
- `calculatedAt`, `simulationRunId`, optional `scenarioId`
- `diagnostics`/`warnings` for missing or inconsistent data

Make the payload stable and straightforward for a dashboard to consume.

## 6. NATS messaging

NATS is the message broker. Reuse the repository's NATS client if available; otherwise choose a maintained client compatible with the runtime.

- Configurable connection URL, e.g. `nats://localhost:4222`.
- Reconnect handling and connection health.
- Publish asynchronously; publishing failure must not crash the simulation loop.
- Use bounded buffering/backpressure; never allow unbounded memory growth if NATS is unavailable.
- Structured JSON initially, unless the repository already uses another serialization format.
- Include schema version, event ID, simulation run ID, asset ID, and UTC timestamp where applicable.
- Log failures and expose broker status.
- Do not add JetStream unless already used or clearly needed. If using Core NATS, document its delivery limitations accurately; do not claim durable delivery.
- Make subject tokens lowercase and safe. Asset IDs may contain unsuitable characters; implement deterministic encoding/normalization and include the original asset ID in the payload.

Unless the repository has an established convention, use:

```text
iiot.simulator.v1.telemetry.<assetType>.<assetToken>
iiot.simulator.v1.events.machine-state.<assetToken>
iiot.simulator.v1.events.downtime.<assetToken>
iiot.simulator.v1.events.production.<assetToken>
iiot.simulator.v1.events.quality.<assetToken>
iiot.simulator.v1.kpi.oee.<assetToken>
iiot.simulator.v1.status.simulation
```

Only implement control subjects if there is a real NATS subscriber/control use case. HTTP APIs are sufficient for simulator control by default. Do not document unimplemented subjects as if they exist.

### Mandatory topic documentation
Create `docs/nats-topics.md`. For every subject actually published or subscribed to, document:
- Exact subject and direction (publish/subscribe).
- Purpose and producer.
- Known consumers (or explicitly state unknown/external).
- Complete example payload and field definitions.
- Units and timestamp semantics.
- Publishing trigger/frequency.
- Core NATS or JetStream.
- Delivery/retry limitations.
- Schema versioning and compatibility policy.

Cover telemetry, machine-state, downtime, production, quality, OEE KPI, and simulation status subjects if implemented. Keep topic count sensible.

## 7. HTTP API

Expose management/inspection APIs. Follow existing API conventions; use `/api/v1` if no versioning standard exists. These APIs control this simulator only, not Asset Model or Telemetry services.

Implement equivalent routes (adjust only to match established conventions):

**Health**
- `GET /health` — liveness.
- `GET /health/ready` — readiness including NATS and required metadata source.
- `GET /api/v1/simulation/status` — lifecycle state, run ID, scenario, simulation clock, speed, NATS status.

**Lifecycle**
- `POST /api/v1/simulation/start`
- `POST /api/v1/simulation/pause`
- `POST /api/v1/simulation/resume`
- `POST /api/v1/simulation/stop`
- `POST /api/v1/simulation/reset` — reset in-memory state only.

Make lifecycle calls idempotent where sensible; return clear validation/conflict errors for invalid transitions.

**Configuration/scenarios**
- `GET /api/v1/simulation/config`
- `PUT /api/v1/simulation/config`
- `GET /api/v1/scenarios`
- `GET /api/v1/scenarios/{scenarioId}`
- `POST /api/v1/simulation/scenario`

Configuration should include speed multiplier, tick interval, seed, shift schedule/breaks, ideal rates/cycle times and units, speed ranges, fault schedule/probability, reject probability/defect distribution, and batch/routing settings. Reject unsafe live configuration changes or define exactly which can be changed while running.

**OEE and inspection**
- `GET /api/v1/oee/{assetId}?from=...&to=...`
- `GET /api/v1/oee/{assetId}/current-shift`
- `GET /api/v1/assets` — resolved asset IDs/types known to simulator.
- `GET /api/v1/assets/{assetId}/variables` — variable mappings used.
- `GET /api/v1/simulation/metrics` — current states/counters for debugging/demo.

Do not invent a telemetry-history API requiring a Time-Series DB query. Omit it unless an existing real API is discovered and intentionally integrated.

Use DTOs, validation, useful error responses, and Swagger/OpenAPI examples. Document actual routes and payloads.

## 8. Asset metadata and variable mappings

Discover existing Asset Model integration. Resolve real IDs for:
ProductionLine01, Station01, Mixer_01, Boiler_Hub, Boiler_01, Boiler_02, Pump_0, Packager.

Resolve variable definitions and validate required names, IDs, data types, and units. Use real IDs in NATS payloads. Do not create/update asset types, assets, hierarchy, or variable definitions. Do not treat `createdAt`/`updatedAt` audit fields as telemetry.

If a required variable is missing, report it clearly; do not silently publish a differently named variable. Implement a mapping layer from simulator signals to actual variable-definition IDs/names/types/units. Document caching/refresh and failure modes.

A local fixture may be used for development/tests only, clearly labelled and never mistaken for platform metadata.

## 9. Database boundaries

Platform stores:
- PostgreSQL: asset hierarchy and asset metadata.
- Time-Series Database: time-dependent telemetry.

Expected boundary:
- Read asset metadata from existing Asset Model API (or existing established read-only adapter).
- Publish telemetry/events/OEE to NATS.
- Existing ingestion consumers persist time-series data.
- Do not mutate PostgreSQL hierarchy.
- Do not assume the Time-Series DB product/schema.
- OEE must calculate from the simulator's own generated event/counter model; it must work without querying the dashboard or DB.
- If repository architecture requires querying a telemetry API for OEE, isolate that behind an interface and use only a discovered real contract.

The service should be runnable with NATS plus a development metadata fixture, while real metadata integration remains configurable.

## 10. Documentation deliverables

Create a `docs/` directory inside the service directory. Documentation is a required deliverable and must describe implemented behaviour, not planned features.

Create:

### `README.md`
Purpose, boundaries, architecture/data flow, supported assets, prerequisites, local/Docker run instructions, configuration, lifecycle usage, NATS verification, OEE verification, troubleshooting, and links to detailed docs. Explicitly state this is a simulator + OEE calculator, not the dashboard or Asset Model Service.

### `docs/architecture.md`
Responsibilities/boundaries, components, simulation lifecycle, machine states, batch flow, OEE flow, NATS publishing, asset metadata lookup, failure/recovery, Mermaid diagrams.

### `docs/api-reference.md`
Every implemented endpoint, method/route, purpose, path/query parameters, request/response examples, validation/errors, lifecycle transitions, Swagger location, and relevant omissions.

### `docs/nats-topics.md`
Mandatory complete subject catalogue as specified in Section 6, with payload examples, field definitions, units, triggers, direction, consumers, delivery semantics, and versioning.

### `docs/simulation-model.md`
Per-asset simulation rules, state transitions, batch correlation, tick/time multiplier, production speed/counters, quality/reject model, faults/jams/setup/downtime, deterministic seed/scenarios, counter reset/restart semantics.

### `docs/oee-calculation.md`
Formulas, units, planned vs operating time, state treatment, window clipping, counter deltas, count reconciliation, zero/invalid data, worked example, and why line OEE is not the average of machine OEE.

### `docs/configuration.md`
Every environment variable/config property, default, required/optional status, example configuration, NATS and Asset Model settings, rates/schedules/scenarios/seeds, logging/health, and secrets handling.

### `docs/development-and-testing.md`
Project structure, build/run/test commands, unit/integration/E2E strategy, local NATS, inspecting subjects/messages, adding equipment/scenarios, schema evolution.

## 11. Suggested structure

Place the service in the repository's established service directory, e.g. `services/production-simulator/`. Follow existing conventions rather than blindly copying this structure.

```text
production-simulator/
├── src/
│   └── ProductionSimulator.Api/
│       ├── Api/                 # endpoints/controllers and DTOs
│       ├── Application/
│       │   ├── Simulation/
│       │   ├── Oee/
│       │   └── Scenarios/
│       ├── Domain/
│       │   ├── Assets/
│       │   ├── Equipment/
│       │   ├── Events/
│       │   └── Production/
│       ├── Infrastructure/
│       │   ├── Messaging/
│       │   ├── AssetMetadata/
│       │   └── Time/
│       ├── Configuration/
│       └── Program.cs
├── tests/
│   ├── ProductionSimulator.UnitTests/
│   └── ProductionSimulator.IntegrationTests/
├── docs/
├── Dockerfile
├── appsettings.json
└── README.md
```

Do not create one microservice per machine. One service with modular equipment simulators is enough. Keep domain logic, OEE, HTTP, NATS, metadata integration, and configuration separated.

## 12. Testing requirements

Write automated tests, at minimum:

**OEE**
- Availability with no downtime and with downtime.
- Downtime partially outside reporting window.
- Planned breaks excluded.
- Performance at ideal speed = 100%, and below ideal speed.
- Quality with zero and nonzero rejects.
- OEE product calculation.
- Empty window and zero total count.
- `good + rejected != total` diagnostic.
- Invalid/out-of-range OEE diagnostic.

**Simulation**
- State transitions.
- No production while stopped/faulted/idle.
- Fractional accumulator.
- Counter reconciliation.
- Same seed gives reproducible output.
- Fault/recovery intervals.
- Batch ID propagation.
- Shift/break boundaries.
- Pause/resume does not advance simulation time while paused.

**API/messaging**
- Subject selection and payload schema.
- Publish failure does not stop simulation.
- Bounded queue/backpressure.
- Lifecycle API transitions.
- Invalid config validation.
- OEE endpoint matches calculation engine.
- Health/readiness reflects dependency state.

Use fake clocks and fake publishers for unit tests. Integration tests may use disposable NATS if the repo supports containers. Pure simulator/OEE unit tests must not need live PostgreSQL or a Time-Series DB.

## 13. Operational quality

Implement structured logs, correlation IDs (`simulationRunId`, `eventId`, `assetId`, `batchId`), health/readiness, graceful shutdown, and useful metrics:
- Simulation state and speed.
- Ticks processed.
- Messages published and publish failures.
- Generated total/good/rejected counts.
- Current machine states.
- Last successful NATS publish time.

Do not create unbounded queues/tasks. Do not log secrets. Reuse existing observability conventions; do not build a separate observability platform.

## 14. Docker/local development

If Docker Compose exists:
- Add this service consistently to existing Compose only if appropriate.
- Reuse the existing NATS service/network; never create a second broker.
- Do not add duplicate PostgreSQL or Time-Series DB containers.
- Add required environment variables and health dependencies.
- Support local VS Code execution too.

If no Compose setup exists, provide a minimal Dockerfile and local run instructions. Add `.env.example` with placeholders only. Never commit credentials.

## 15. Definition of done

- [ ] Standalone simulator service in the correct directory.
- [ ] No modifications to Asset Model Service or hierarchy.
- [ ] Real asset IDs/variable mappings resolved or explicitly configured.
- [ ] All listed assets simulated coherently.
- [ ] Telemetry, production, quality, state, and downtime events generated.
- [ ] Messages published to NATS on documented subjects.
- [ ] OEE calculated from generated data, not random values.
- [ ] OEE snapshots published for dashboard consumption.
- [ ] Documented lifecycle/config/status/OEE APIs.
- [ ] Deterministic demo scenario with known expected OEE.
- [ ] Automated tests pass.
- [ ] All required docs exist and match implementation.
- [ ] `docs/nats-topics.md` documents every actual subject.
- [ ] Build, formatter, and tests pass.
- [ ] Docker/local instructions verified.
- [ ] No dashboard/frontend code created.
- [ ] No guessed Asset Model or Time-Series DB APIs introduced.

## 16. Execution sequence and final report

Execute in this order:
1. Inspect repository and report relevant conventions/integrations.
2. Choose service directory and present a concise plan.
3. Define domain models, clock, state machine, counters/events, and OEE rules.
4. Implement deterministic Packager + ProductionLine first.
5. Add Mixer, boilers, Pump, and batch correlation.
6. Add NATS contracts/publisher.
7. Add Asset Model integration or isolated development fixture.
8. Add HTTP lifecycle/configuration/OEE APIs.
9. Add tests.
10. Write and verify documentation.
11. Integrate Docker/Compose only where appropriate.
12. Run formatter, build, unit tests, and available integration tests.
13. Fix failures; do not merely report them.
14. Review the final diff for changes outside simulator scope.

At completion, report:
- Exact directory created.
- Architecture and major components.
- Implemented HTTP endpoints.
- Complete list of NATS subjects.
- OEE formulas and assets enabled for OEE.
- Local and Docker run instructions.
- Test commands and results.
- Documentation files created.
- Assumptions, limitations, and integrations still requiring configuration.

**Do not stop at empty scaffolding or placeholder docs. Deliver a working, testable simulator with a repeatable demo scenario. If a contract is missing, isolate and document it, then continue without inventing an API.**
