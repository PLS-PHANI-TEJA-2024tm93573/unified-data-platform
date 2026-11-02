# NATS topics

All subjects in this service use Core NATS (no JetStream). Published messages are JSON. Core NATS does not persist or acknowledge messages; a disconnected publish is dropped and counted. There are no subscriptions/control subjects. Schema changes are additive within major version 1; incompatible changes require a new `v2` subject. Event envelopes use `schemaVersion: "1.0"`, UUID `eventId`, `simulationRunId`, original `assetId`, `assetName`, and UTC simulation `timestamp` where stated. Consumers outside this repository are unknown; `industrial.measurements` is consumed by Data Service.

| Subject | Direction / producer | Purpose / trigger | Known consumer |
|---|---|---|---|
| `industrial.measurements` | Publish, simulator | One mapped signal sample per asset variable each active tick. Contract matches existing ingestion. | Data Service subscriber. |
| `iiot.simulator.v1.telemetry.<assetType>.<assetToken>` | Publish, simulator | Typed signal sample for each configured mapped variable each active tick. | Unknown/external. |
| `iiot.simulator.v1.events.machine-state.<assetToken>` | Publish, simulation engine | State transition only. | Unknown/external. |
| `iiot.simulator.v1.events.downtime.<assetToken>` | Publish, simulation engine | Fault/jam start/end event. | Unknown/external. |
| `iiot.simulator.v1.events.production.<assetToken>` | Publish, simulation engine | Packager cumulative output snapshot at configured publish interval. | Unknown/external. |
| `iiot.simulator.v1.events.quality.<assetToken>` | Publish, simulation engine | One decision for each produced unit. | Unknown/external. |
| `iiot.simulator.v1.kpi.oee.<assetToken>` | Publish, OEE engine | Packager and line OEE snapshot each tick. | Unknown/external/dashboard. |
| `iiot.simulator.v1.status.simulation` | Publish, lifecycle controller | Pause, resume, and stop status changes. | Unknown/external. |

`<assetToken>` is lowercase with characters outside `[a-z0-9_-]` replaced by `_`; the original ID remains in the body. `<assetType>` is lowercase. Telemetry samples include `schemaVersion`, `eventId`, `simulationRunId`, `assetId`, `assetName`, `variableId`, `variableName`, `unit`, UTC simulation `timestamp`, and typed `value`. Values use the variable-definition's types and units (for example °C, psi, L/min, bottles/min).

Example platform ingestion message:

```json
{"variable_id":"10000000-0000-4000-8000-000000000801","timestamp":"2026-11-02T12:00:00.000Z","value":42.5}
```

The fixture UUID above is synthetic. With real Asset Model metadata, `variable_id` is the assigned AssetVariable UUID expected by the existing Data Service; the Data Service rejects unknown IDs or values incompatible with metadata types.

For `Mixer_01`, each active tick publishes the mapped signals `machine_status` (string), `time_running` (seconds), `ingredient_weight` (grams), `mixing_speed` (rpm), `batch_count` (batches), `batch_rejected_count` (batches), `actual_cycle_time` (seconds/batch), and `batch_id` (string). Each signal is a separate `industrial.measurements` message, with its own AssetVariable UUID in `variable_id`. For example, `mixing_speed` is sent as a numeric `value`; the Data Service resolves that UUID to Mixer_01's variable metadata before inserting the reading into `measurements`.

Every custom telemetry sample contains `schemaVersion`, `eventId`, `simulationRunId`, `assetId`, `assetName`, `variableId`, `variableName`, `unit`, UTC simulation `timestamp`, and a `value` whose JSON type matches `dataType`.

Example custom telemetry message:

```json
{"schemaVersion":"1.0","eventId":"30d784b1-6e6c-4ee6-9e60-01db451a704f","simulationRunId":"7d2ec47c-62db-4373-85a9-9cb746a8dc80","assetId":"00000000-0000-4000-8000-000000000008","assetName":"Packager","variableId":"10000000-0000-4000-8000-000000000801","variableName":"machine_status","unit":"-","timestamp":"2026-11-02T12:00:00.000Z","value":"RUNNING"}
```

Example machine-state message:

```json
{"schemaVersion":"1.0","eventId":"d0e0cf9a-f8a3-4360-a4c4-cf59ac96c240","simulationRunId":"7d2ec47c-62db-4373-85a9-9cb746a8dc80","assetId":"00000000-0000-4000-8000-000000000008","assetName":"Packager","timestamp":"2026-11-02T12:00:00.000Z","previousState":"IDLE","state":"RUNNING"}
```

Production example (common fields plus cumulative counters and batch correlation):

```json
{"schemaVersion":"1.0","eventId":"d0e0cf9a-f8a3-4360-a4c4-cf59ac96c240","simulationRunId":"7d2ec47c-62db-4373-85a9-9cb746a8dc80","assetId":"00000000-0000-4000-8000-000000000008","assetName":"Packager","timestamp":"2026-11-02T12:00:00.000Z","totalCount":100,"goodCount":98,"rejectedCount":2,"batchId":"batch-1"}
```

Quality adds `decision` (`ACCEPT`/`REJECT`), `defectReason` (`underfill`, `overfill`, `cap_failure`, `label_failure`, or null), and `unitNumber`:

```json
{"schemaVersion":"1.0","eventId":"d0e0cf9a-f8a3-4360-a4c4-cf59ac96c240","simulationRunId":"7d2ec47c-62db-4373-85a9-9cb746a8dc80","assetId":"00000000-0000-4000-8000-000000000008","assetName":"Packager","timestamp":"2026-11-02T12:00:00.000Z","decision":"REJECT","defectReason":"underfill","unitNumber":101}
```

Downtime `event` is `start` or `end`; `reason` is `unplanned_fault` or `jam`. Start includes `start` and may include `durationSeconds`; end includes `assetName`, `start`, and `end`:

```json
{"schemaVersion":"1.0","eventId":"d0e0cf9a-f8a3-4360-a4c4-cf59ac96c240","simulationRunId":"7d2ec47c-62db-4373-85a9-9cb746a8dc80","assetId":"00000000-0000-4000-8000-000000000008","assetName":"Packager","timestamp":"2026-11-02T12:00:05.000Z","event":"end","reason":"jam","start":"2026-11-02T12:00:00.000Z","end":"2026-11-02T12:00:05.000Z"}
```

OEE adds the result fields: asset identity/type, reporting start/end, planned/operating/downtime seconds, ideal production rate and unit, total/good/rejected counts, four percentages (nullable when unavailable/invalid), calculation UTC time, run ID, optional scenario ID, and diagnostics. Example:

```json
{"schemaVersion":"1.0","eventId":"d0e0cf9a-f8a3-4360-a4c4-cf59ac96c240","simulationRunId":"7d2ec47c-62db-4373-85a9-9cb746a8dc80","timestamp":"2026-11-02T12:00:00.000Z","assetId":"00000000-0000-4000-8000-000000000008","assetName":"Packager","assetType":"PACKAGER","reportingWindowStart":"2026-11-02T11:00:00.000Z","reportingWindowEnd":"2026-11-02T12:00:00.000Z","plannedProductionTimeSeconds":3600,"operatingTimeSeconds":3600,"downtimeSeconds":0,"idealProductionRate":60,"idealProductionRateUnit":"bottles/min","totalCount":3600,"goodCount":3528,"rejectedCount":72,"availabilityPercent":100,"performancePercent":100,"qualityPercent":98,"oeePercent":98,"calculatedAt":"2026-11-02T12:00:00.000Z","diagnostics":[]}
```

Simulation status publishes lifecycle state, optional run/scenario IDs, simulation time, speed, tick interval, and current NATS health. The HTTP status response additionally includes metadata source. The reset status message additionally carries `event: "reset"`, `previousSimulationRunId`, and UTC wall timestamp. All example event and telemetry timestamps are UTC simulation time; `calculatedAt` and reset timestamp are wall-clock UTC.

Only measurement messages are currently mapped to stable platform schema. The custom telemetry/events/KPI/status schemas are simulator v1 contracts, not platform ingestion records. Core NATS publication is immediate and bounded (zero retained disconnected buffer): failures increment `dropped`; no retries or durable delivery are claimed. The client reconnects for future publications. There is no message replay.
