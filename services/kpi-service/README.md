# KPI Service

FastAPI service that reads telemetry history from the Data Service, calculates OEE for configured production assets, persists readings to TimescaleDB, and streams readings to connected clients. The production simulator remains a telemetry publisher; OEE calculation belongs to this service.

## Run locally

Copy `.env.example` to `.env`, set the Asset Model and Data Service URLs, then run:

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

At startup, `ASSET_MODEL_URL` (default `http://localhost:3000`) is queried through `GET /assets/hierarchy` to resolve `ProductionLine01` and `Packager`. The service then calls `GET /assets/{assetId}/variables` for each asset to get the AssetVariable assignment IDs required by Data Service. `DATA_SERVICE_URL` (default local port `3001`) serves the existing `GET /measurements?asset_variable_id=<UUID>&from=<ISO-8601>&to=<ISO-8601>&limit=<n>` API. Responses contain `data: [{"timestamp":"...","value":...}]`. It does not read simulator OEE events.

## Configuration

Asset IDs and variable assignment IDs are populated automatically at startup. `ASSET_CONFIG_JSON` can override per-asset OEE tuning. For the simulator demo, the service defaults the ideal rate to 60 bottles/minute for `ProductionLine01` and `Packager`. OEE is initially enabled only for those two assets. The remaining assets are documented and can be enabled when their production and quality measurements are meaningful.

`CORS_ORIGINS` is a comma-separated list of browser origins allowed to call the HTTP API. It defaults to `http://localhost:4200` and `http://127.0.0.1:4200`. Add the dashboard's deployed origin when hosting the UI elsewhere.

```json
{
  "ProductionLine01": {
    "ideal_rate_per_minute": 60,
    "shift_duration_minutes": 480,
    "planned_break_minutes": 30,
    "shift_start_utc": "00:00",
    "operating_states": ["RUNNING", "HEATING"],
    "max_state_gap_seconds": 30,
    "max_counter_gap_seconds": 30
  },
  "Packager": {
    "ideal_rate_per_minute": 60,
    "shift_duration_minutes": 480,
    "planned_break_minutes": 30,
    "shift_start_utc": "00:00",
    "operating_states": ["RUNNING"],
    "max_state_gap_seconds": 30,
    "max_counter_gap_seconds": 30
  }
}
```

Use `ideal_rate_per_minute` for bottle output. For batch/cycle equipment, configure `ideal_cycle_time_seconds` (Mixer: 120; Boiler_01 and Boiler_02: 180); the calculator converts this to ideal units per minute. Pump_0 uses a configurable `ideal_transfers_per_hour` when enabled. Do not use observed `production_speed`, `actual_cycle_time`, or `actual_transfer_cycle_time` as ideal values. Schedules repeat the configured shift length from `shift_start_utc` in UTC; the planned break is placed at each shift's end. `max_state_gap_seconds` limits how long a status sample is considered current.

`counter_baseline_days` (default 1) controls how far before the requested start the KPI Service queries for a cumulative-counter baseline. Keep it long enough to find a measurement at or before the window start. Configure real IDs from Asset Model; the simulator's fixture IDs are not Data Service IDs.

## Calculation

For the requested window, the KPI Service calculates cumulative counter deltas. A reset, missing boundary baseline, missing counter, negative delta, or non-reconciling good/rejected totals invalidates output metrics for that window. It sums `good + rejected` and requires it to equal total output. Output intervals do not bridge a counter reset.

Operating time is duration-weighted from `line_status` or `machine_status` history, using only configured operating states. Status intervals are clipped to scheduled production intervals. Planned breaks do not contribute to planned production time. Missing or stale status history is unknown, never downtime; if status does not cover the planned window, availability and OEE are null. `max_state_gap_seconds` controls state sample freshness. `max_counter_gap_seconds` controls whether the last cumulative counter sample is fresh enough to trust the window's output delta. `time_running`, if mapped, can be used for validation later but is not the primary availability source.

```text
Availability = Operating Time / Planned Production Time
Performance  = (Total Output × Ideal Cycle Time) / Operating Time
             = Total Output / (Ideal Rate × Operating Time)
Quality      = Good Output / Total Output
OEE          = Availability × Performance × Quality
```

The factors are returned as percentages; OEE is their fractional product converted back to a percentage. Zero denominators yield `null` for the affected factor and OEE. Line OEE uses line output counters directly; it is never an average of child-machine OEE. The current simulator mirrors Packager output at ProductionLine01, so their readings can match.

## Asset variable mappings

Variable names are mapped as supplied by the telemetry schema. Station01 and Boiler_Hub are logical grouping assets and do not receive independent OEE.

| Asset | Status | Total output | Good output | Rejected output |
|---|---|---|---|---|
| ProductionLine01 | `line_status` | `total_bottles` | `total_good_bottles` | `total_rejected_bottles` |
| Station01 | `station_status` | — | — | — |
| Mixer_01 | `machine_status` | `batch_count` | `good_batch_count` | `rejected_batch_count` |
| Boiler_Hub | `hub_status` | — | — | — |
| Boiler_01 | `machine_status` | `heating_cycle_count` | `good_cycle_count` | `rejected_cycle_count` |
| Boiler_02 | `machine_status` | `heating_cycle_count` | `good_cycle_count` | `rejected_cycle_count` |
| Pump_0 | `machine_status` | `transfer_cycle_count` | `good_transfer_count` | `rejected_transfer_count` |
| Packager | `machine_status` | `total_bottles` | `good_bottles` | `rejected_bottles` |

The non-enabled assets are prepared for later configuration. Their mappings must be present in Asset Model/Data Service and their good/rejected counts must reconcile with the total production unit before enabling OEE. In particular, the currently described simulator telemetry uses different names for some future good/rejected batch counters; no variables are added or changed here.

## API

- `GET /health`
- `GET /api/v1/oee/{asset_id}?start=<ISO-8601>&end=<ISO-8601>` calculates one reading from Data Service history.
- `GET /api/v1/oee/{asset_id}/history?start=<ISO-8601>&end=<ISO-8601>` returns persisted readings for the inclusive window.
- `WS /api/v1/oee/{asset_id}/live` streams OEE through the current time at each poll. It starts at the first complete telemetry sample when shift-start history is unavailable, and re-anchors after an unplanned data gap or counter reset. The payload includes `calculation_start` and `calculation_period` (`since_start` or `since_recovery`).
- Interactive OpenAPI documentation: `/docs`; schema: `/openapi.json`.

Example response:

```json
{
  "asset_id": "<packager-asset-uuid>",
  "timestamp": "2026-11-03T12:00:00Z",
  "availability_percent": 95.0,
  "performance_percent": 92.0,
  "quality_percent": 98.0,
  "oee_percent": 85.652,
  "planned_production_seconds": 27000.0,
  "operating_seconds": 25650.0,
  "total_output": 690,
  "good_output": 676,
  "rejected_output": 14
}
```

Run `docker compose up --build` from this directory. Set `DATA_SERVICE_URL`, `DATABASE_URL`, and `ASSET_CONFIG_JSON` in the environment or a local `.env` file.

For the live simulator OEE behavior and rollback steps, see [Live OEE Demo Change and Rollback Notes](Docs/live-oee-demo-rollback.md).
