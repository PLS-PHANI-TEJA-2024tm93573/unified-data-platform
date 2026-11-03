# KPI Service OEE Calculation

This document describes how the dashboard's live OEE values are produced, what
their time window means, and when the service returns `null`.

## Demo data and permitted assumptions

**This project currently uses generated simulator data, not measurements from a
real factory. Because the data is simulated, the demo is permitted to use the
simulator's 60 bottles/minute ideal rate, treat the first complete set of
telemetry as the start baseline when shift-start history is unavailable, and
start a new calculation segment after an ingestion gap or counter reset.** These
are explicit demo assumptions. They are not proof of what happened during a
missing interval and should not be applied to factory data without approval of
the schedule, ideal rates, state meanings, and data-gap policy.

The simulator's default ideal rate is 60 bottles/minute. The KPI Service uses
that rate by default for both `Packager` and `ProductionLine01`; an
`ASSET_CONFIG_JSON` value can override it.

## Data path and enabled assets

The live path is:

```text
Production Simulator → NATS → Data Service → KPI Service → WebSocket and TimescaleDB
```

The Asset Model supplies the asset IDs and the per-asset variable-assignment
IDs. The KPI Service asks the Data Service for histories using those assignment
IDs, then maps each history by its variable name.

OEE is enabled for these two assets:

| Asset | Status input | Total output | Good output | Rejected output |
|---|---|---|---|---|
| `Packager` | `machine_status` | `total_bottles` | `good_bottles` | `rejected_bottles` |
| `ProductionLine01` | `line_status` | `total_bottles` | `total_good_bottles` | `total_rejected_bottles` |

The line calculation uses the line's own counters. It does not average OEE
values from child machines. In the current simulator, line and Packager output
counters mirror the same production, so their values can be very close.

The hierarchy setup script, [`scripts/oee_hierarchy.sh`](../scripts/oee_hierarchy.sh),
creates or reuses these telemetry definitions and assignments. Availability,
performance, quality, and OEE are calculated outputs; they are not telemetry
variables to create in Asset Model.

## Formulas

The KPI Service uses cumulative counter changes over a calculation window:

```text
total_output   = total counter at end − total counter at window start
good_output    = good counter at end − good counter at window start
rejected_output = rejected counter at end − rejected counter at window start
```

It also sums operating time from status history and planned production time
from the configured schedule.

```text
Availability = operating seconds / planned production seconds × 100

Performance  = total output /
               (ideal units per minute × operating minutes) × 100

Quality      = good output / total output × 100

OEE          = Availability × Performance × Quality / 10,000
```

The factors are percentages, so OEE divides their product by 10,000 to return a
percentage. The service does not clamp factors to 100%; a result above 100% can
indicate that actual output exceeded the configured ideal rate or that the
inputs/configuration need review.

For example, if availability is 100%, performance is 95%, and quality is 97%,
OEE is approximately 92.2%.

### Availability

Status samples are interpreted case-insensitively. By default, `RUNNING`,
`HEATING`, `TRUE`, and `1` are operating states. Other fresh status values, such
as `IDLE`, `STOPPED`, or `FAULTED`, count as non-operating time.

The default `max_state_gap_seconds` is 30. A status sample can represent no
more than 30 seconds. The service does not extend a state indefinitely when
updates stop. Every planned part of the window needs status coverage; an
uncovered interval is **unknown**, not downtime. If planned time is not fully
covered, availability and OEE are `null`.

### Performance

Performance uses the configured ideal rate, not the simulator's observed
`production_speed` measurement. The demo defaults to 60 bottles/minute for
both enabled assets. If no positive ideal rate is configured, performance is
`null`, which also makes OEE `null`.

Performance also requires valid total output and positive operating time.

### Quality

Quality uses the good and total counter changes. Before using output metrics,
the service requires:

```text
good_output + rejected_output = total_output
```

If those counter deltas are missing, invalid, reset, negative, or do not
reconcile, all three output values are set to `null`. If total output is zero,
quality is `null` because its denominator is zero. The simulator does not
derive rejects from `bottle_fill_level`; it generates good/rejected counts
directly.

## Time windows and shifts

All KPI timestamps and shift settings are in UTC. The default schedule is:

- Shift duration: 480 minutes (8 hours)
- Shift start: `00:00` UTC
- Planned break: 30 minutes at the end of each shift

With these defaults, shifts start at 00:00, 08:00, and 16:00 UTC. Planned time
ends 30 minutes before each shift boundary. Planned breaks are excluded from
the availability denominator; they are not counted as downtime.

### Live WebSocket window

The live calculation ends at the poll's current timestamp. The default polling
interval is 7 seconds; actual intervals can be longer if history queries take
longer. The loop captures this UTC end time before requesting histories, so the
snapshot timestamp is the query cutoff, not the later time at which queries
finish. Percentage values are emitted as floating-point numbers, without
rounding to whole integers.

At connection time, the service first checks whether every required signal has
a fresh reading at or before the configured shift boundary and a later reading
inside the window:

1. If so, it calculates from that shift boundary through now.
2. If not, it starts at the first timestamp by which status and all three
   counters have appeared. The first counter values provide the baseline; a
   later reading is needed to calculate their deltas.

This second case is what lets the simulator demo calculate OEE when the
simulator started after the calendar shift began. For example, if the default
shift began at 16:00 UTC but the first complete telemetry arrived at 19:20 UTC,
the live window can start around 19:20 instead of failing due to missing
16:00-era baselines. That result is for the observed period, not the full shift.

The WebSocket payload includes:

- `calculation_start`: UTC start time used for that snapshot
- `calculation_period`: `since_start` for the initial segment, or
  `since_recovery` after a gap or counter reset

These two fields are live WebSocket metadata. The existing OEE database schema
continues to store the OEE values and timestamp as before; it does not store
these period labels.

### Gaps, restarts, and resets

The live service uses 30 seconds by default for both
`max_state_gap_seconds` and `max_counter_gap_seconds`.

- While data is missing, status beyond its freshness limit is unknown, so
  availability and OEE can be `null`.
- When telemetry resumes after a gap that includes more than the freshness
  threshold of planned production time, the service re-anchors at the first
  post-gap data point. It calculates a new partial period from recovery through
  now and labels it `since_recovery`.
- A decrease in a cumulative counter is treated as a counter reset. The live
  calculation starts a new segment at the reset point rather than adding
  across the reset.
- A gap covered only by the configured planned break does not start a new
  segment. The break is excluded from planned time.
- During recovery, the first post-gap sample establishes a baseline. A later
  sample is needed to produce counter deltas, so the first snapshot after
  recovery may still have null output-derived factors.

Re-anchoring does not reconstruct or guess what happened during a missing
interval. A later `since_recovery` result describes only its new segment; it
must not be presented as full-shift OEE.

## Conditions that produce `null`

OEE is `null` if any of its three factors is `null`. Common causes are:

- No complete set of required status and counter histories is available yet.
- A cumulative counter has no usable baseline at or before the calculation
  start, or no later sample inside the window.
- The latest counter sample is more than the configured freshness limit from
  the window end.
- In an explicitly requested HTTP window, a counter decrease or invalid counter
  value invalidates output deltas. In live mode, a detected decrease starts a
  new segment; the first snapshot can remain null until another sample arrives.
- Good and rejected output do not add up to total output.
- Status history does not cover all planned production time.
- The window contains no planned production time, such as a window entirely
  inside a planned break.
- Total output is zero, so quality has no valid denominator.
- No positive ideal rate is configured, or there is no operating time for
  performance.

An OEE reading with one numeric factor and another `null` is possible. For
example, performance may be available from partial observed operating time
while availability is `null` because status coverage is incomplete; OEE remains
`null` in that case.

If one or more required measurement histories are entirely absent, the live
stream waits for the inputs instead of broadcasting an OEE snapshot. Once the
histories exist, an individual factor can still be `null` until it has a valid
baseline and enough subsequent readings.

## HTTP calculations, storage, and scale notes

`GET /api/v1/oee/{asset_id}?start=...&end=...` calculates the explicitly
requested window. It uses the same formulas and input validation, but the
live-only start/recovery selection does not rewrite the caller's window.
`GET /api/v1/oee/{asset_id}/history` returns persisted snapshots.

The explicit HTTP calculation checks that a counter baseline and latest sample
are fresh enough and rejects observed counter decreases, but it does not
re-anchor around every internal telemetry gap. For status, its calculation
caps each sample's contribution to `max_state_gap_seconds`, but it does not
separately reject an old status sample before the requested start. The live
path validates its selected start boundary and applies the live gap selection.

Each completed live calculation is inserted into the existing
`oee_telemetry` table and then broadcast to connected WebSocket clients. No
database schema change is required for the live calculation-period fields.

The Data Service limits each measurement query to 10,000 rows; the KPI Service
reads histories in hourly slices and errors if a slice reaches that cap. The
live loop re-reads the expanding calculation history at each poll. This is
suitable for the simulator demo, but long-running/high-rate production streams
should use incremental history collection rather than repeatedly fetching the
whole window.

## Simulator-specific caveats

- The simulator starts with in-memory counters and a run-relative shift clock.
  A simulator restart can reset counters and starts a new run.
- The simulator publishes measurements during active production ticks. During
  a fault or jam it emits lifecycle/state events, but may stop publishing the
  status and counter measurement series until production resumes. The Data
  Service stores measurement messages, not those event intervals. If the gap
  exceeds the live freshness threshold, the KPI Service treats it as missing
  history and re-anchors after recovery; it cannot count the unobserved fault
  duration as downtime. This can make demo availability higher than an OEE
  calculation with complete downtime telemetry.
- The simulator's NATS publisher is best-effort rather than a durable queue.
  Messages lost while a consumer or broker is disconnected are not
  automatically replayed from the simulator.
- Measurement rows store asset-variable ID, timestamp, and value; they do not
  store the simulator's `simulationRunId`. The KPI Service therefore infers
  initial starts and recovery points from the telemetry timestamps and counter
  values. If a simulator restart has neither an observable gap nor a counter
  decrease, it cannot be identified reliably from stored measurements alone.
- The simulator publishes status and counters while its production loop is
  active. Planned-break behavior and the KPI schedule must agree. If simulator
  shift duration/break settings differ from the KPI configuration, availability
  can be biased or gaps can be classified against the wrong schedule.
- The default rates and state mappings are demo settings. For real equipment,
  use approved ideal rates, validated counter definitions, the plant's actual
  shift calendar/time zone, and a documented policy for missing data and
  counter resets.
