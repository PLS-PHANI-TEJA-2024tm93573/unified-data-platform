# Simulator asset telemetry coverage

This note summarizes which variables the production simulator publishes for the assets in the `ProductionLine01` hierarchy and how to interpret those readings when configuring OEE.

## Asset Model mode

To use real Asset Model IDs, configure the simulator with:

```env
METADATA_MODE=asset-model
ASSET_MODEL_URL=http://localhost:3000
```

The hierarchy and variable assignments must already exist in Asset Model. This mode changes the source of asset and variable IDs; it does not change how the simulator generates values. The simulator matches variables by name and publishes each measurement using its mapped AssetVariable ID. A signal without a matching mapping is skipped.

## Variable coverage and limitations

All variable names defined in `scripts/ProductionLine01_OEE_Asset_Hierarchy.txt` are included in the simulator's signal mappings. Some are simplified, fixed, or derived values, so presence in the telemetry stream does not guarantee that the value is a realistic independent measurement.

| Asset | Telemetry coverage and limitations |
|---|---|
| **ProductionLine01** | All four variables are produced. Bottle counters mirror Packager counters; `line_status` mirrors Packager state. |
| **Station01** | Both variables are produced. `station_status` mirrors Packager state; `active_equipment_count` is derived from simulated machine states. |
| **Mixer_01** | All eight variables are produced. `batch_rejected_count` is always `0`; `actual_cycle_time` is fixed at 120 seconds. |
| **Boiler_Hub** | All three variables are produced. Hub status is always `RUNNING`; available boiler count is always `2`. |
| **Boiler_01** | All eleven variables are produced. Rejected batch count is always `0`; cycle time is fixed at 180 seconds. |
| **Boiler_02** | All eleven variables are produced, but the simulated boiler remains idle: running time and cycle count stay at zero, and cycle time is zero. |
| **Pump_0** | All nine variables are produced. Rejected transfer count is always `0`; volume and flow are simplified generated values. |
| **Packager** | All ten variables are produced. Bottle fill level varies, but reject decisions are generated separately; the fill reading does not determine whether a bottle is rejected. |

## Variables required for OEE calculations

The KPI Service configuration uses these exact variable names when resolving the AssetVariable UUIDs supplied by Asset Model. OEE is enabled initially only for ProductionLine01 and Packager; Station01 and Boiler_Hub are grouping assets and are never calculated independently.

| Asset | Required KPI variable names |
|---|---|
| ProductionLine01 | `line_status`, `total_bottles`, `total_good_bottles`, `total_rejected_bottles` |
| Station01 | `station_status` |
| Mixer_01 | `machine_status`, `batch_count`, `good_batch_count`, `rejected_batch_count` |
| Boiler_Hub | `hub_status` |
| Boiler_01 | `machine_status`, `heating_cycle_count`, `good_cycle_count`, `rejected_cycle_count` |
| Boiler_02 | `machine_status`, `heating_cycle_count`, `good_cycle_count`, `rejected_cycle_count` |
| Pump_0 | `machine_status`, `transfer_cycle_count`, `good_transfer_count`, `rejected_transfer_count` |
| Packager | `machine_status`, `total_bottles`, `good_bottles`, `rejected_bottles` |

The future batch and cycle mappings above are the requested KPI contract; the current simulator telemetry table below lists a few differently named or absent quality counters. Those assets should remain disabled until the corresponding measurements exist and reconcile with total output. This documentation does not add or rename Asset Model variables.

Use counter deltas over the same reporting window. The schedule supplies planned production time, and equipment/product configuration supplies the ideal rate or cycle time; neither is provided by these telemetry variables alone.

| Asset | Availability | Performance | Quality | Applicability / notes |
|---|---|---|---|---|
| **ProductionLine01** | `line_status` history, or measured operating time, plus scheduled production time | `total_bottles` delta and configured ideal line rate | `total_good_bottles` delta and `total_bottles` delta; `total_rejected_bottles` can validate the counts | OEE applies. Use the line's final output and rate; do not average child-machine OEE. |
| **Station01** | `station_status` history and scheduled production time can support uptime if states are defined; `active_equipment_count` is an activity indicator, not uptime by itself | — | — | No independent OEE: there is no station-level production count. |
| **Mixer_01** | `time_running` delta and scheduled production time; `machine_status` history can help identify operating states | `batch_count` delta and configured ideal seconds per batch or batches per hour; `actual_cycle_time` is observed cycle duration | `batch_count` delta and `batch_rejected_count` delta; good batches = total batches − rejected batches | OEE is possible if completed batches are the production unit and rejection counts refer to those same batches. |
| **Boiler_Hub** | `hub_status` history may indicate subsystem state. `active_boiler_count` and `available_boiler_count` show current capacity use, not time-based availability | — | — | No independent OEE by default: this is a logical grouping without its own production output. |
| **Boiler_01** | `time_running` delta and scheduled production time; `machine_status` or `heating_cycle_active` history can help identify operation | `heating_cycle_count` delta and configured ideal seconds per cycle or cycles per hour; `actual_heating_cycle_time` is observed cycle duration | `heating_cycle_count` delta and `rejected_batch_count` delta; good cycles/batches = total cycles − rejected batches | OEE is possible if each completed heating cycle maps to a production unit and the batch rejection count is attributable to it. |
| **Boiler_02** | Same signals and schedule as Boiler_01 | Same cycle count and ideal cycle-time inputs as Boiler_01 | Same cycle and rejected-batch counts as Boiler_01 | Same assumptions as Boiler_01. The simulator currently leaves this boiler idle, so it will not yield useful production OEE. |
| **Pump_0** | `time_running` delta and scheduled production time; `machine_status` history can help identify operating states | Choose one unit: `volume_pumped` delta with configured ideal L/min, or `transfer_cycle_count` delta with configured ideal transfers/time. `flow_rate` is observed; `target_flow_rate` is a setpoint and is an ideal only if configured as such | For transfer-count OEE, `transfer_cycle_count` delta and `rejected_transfer_count` delta; good transfers = total transfers − rejected transfers. Volume-based quality requires accepted-volume data, which is not listed | OEE is possible only after choosing a consistent production unit and matching quality counts. Do not mix litres and transfer cycles in one calculation. |
| **Packager** | `time_running` delta and scheduled production time; `machine_status` history helps identify operating and downtime states | `total_bottles` delta and configured ideal bottles/minute; `production_speed` is observed rate, not necessarily the configured ideal | `good_bottles` delta and `total_bottles` delta; `rejected_bottles` can validate the counts | OEE applies. `bottle_fill_level` alone is not a quality count, and the current simulator does not base rejects on that reading. |

For each applicable asset, the standard formulas are:

```text
Availability = Operating Time / Planned Production Time
Performance  = Actual Output / Ideal Output during Operating Time
Quality      = Good Output / Total Output
OEE          = Availability × Performance × Quality
```

The KPI Service reads telemetry through the Data Service's existing `GET /measurements?asset_variable_id=<UUID>&from=<ISO-8601>&to=<ISO-8601>&limit=<n>` API. It requests bounded time slices, computes cumulative counter deltas for the selected window, and uses timestamped status history for operating time. Its configurable default is a 480-minute shift, 30-minute planned break, and UTC shift start at `00:00`; ideal bottle output is 60 bottles/minute, Mixer ideal cycle time is 120 seconds, and each Boiler ideal cycle time is 180 seconds. Pump ideal transfers/hour is configurable. Actual speed/cycle telemetry is not used as an ideal.

Missing or stale status is unknown, not downtime. The service only reports availability when status samples cover scheduled production time; otherwise availability and OEE are null. Counter resets or output totals that do not reconcile also make output-derived factors null. See [KPI Service configuration and API response](../README.md#configuration) for the JSON shape and response fields.

For batch equipment, define a completed batch or cycle as the output unit and use a matching ideal cycle time/rate and quality count. For the pump, choose litres or completed transfers and use that same unit consistently.

## When measurements are published

Measurement variables are emitted on active production ticks. During breaks, faults, or jams, the engine skips that telemetry batch. State transitions and downtime are emitted separately as events, so measurement samples alone do not provide a continuous state history.

## OEE use

For OEE calculations, the most useful telemetry is cumulative production and quality counters, running time, and machine status. Calculate count and running-time changes over a reporting window. Availability also needs planned production time from a schedule, and performance needs a configured ideal rate or cycle time; these are configuration inputs, not supplied by the telemetry variables alone.

Batch cycle counts and cycle times are available for the mixer and boilers, but their usefulness is limited by the simplified values noted above. The simulator's OEE implementation is enabled for **Packager** and **ProductionLine01**; the line result uses Packager output rather than averaging child-machine scores.

## Source files

- [Asset hierarchy and variable definitions](../../../scripts/ProductionLine01_OEE_Asset_Hierarchy.txt)
- [Simulator metadata mappings](../../../production_simulator/src/metadata.js)
- [Simulator telemetry generation](../../../production_simulator/src/engine.js)
- [Simulator OEE calculation](../../../production_simulator/src/oee.js)
