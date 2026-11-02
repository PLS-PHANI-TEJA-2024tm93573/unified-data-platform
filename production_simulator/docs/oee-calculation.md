# OEE calculation

OEE is calculated from generated run counter deltas, configured ideal rate, planned intervals, and fault downtime. No random OEE percentages are generated.

```text
Availability = Operating Time / Planned Production Time
Performance  = Total Count / (Ideal rate × Operating Time)
Quality      = Good Count / Total Count
OEE          = Availability × Performance × Quality
```

The ideal rate is bottles/minute; time is converted to minutes for performance. Performance compares actual output with ideal output for the operating time, so ideal-speed production is 100%. Planned Production Time is the requested time-range overlap with configured shifts less the configured planned break at each shift end. Operating Time is planned time less Packager fault and jam downtime clipped to the reporting window. The same final Packager output boundary is used for line output; machine OEE values are never averaged.

Counts are sampled as cumulative counters and differenced at the range boundaries. `rejectedCount = totalCount - goodCount`. When no sample exists before/within a range, the available in-memory baseline is zero; counters reset on run reset, so reports are run-local. Fault intervals are clipped to the range. Data violating `0 <= good <= total` or resulting in a component outside 0–100% returns diagnostics and null OEE components rather than silently clamping. Zero planned time or zero total count returns null for unavailable components.

Example: 450 planned minutes, 45 minutes qualifying downtime, ideal 60 bottles/minute, total 24,300, good 23,814 gives availability 90%, performance 100%, quality 98%, OEE 88.2%.

Current implementation limitation: caller-specified date ranges are evaluated against the current in-memory run only; there is no historical database query or durable state. A line-level result uses final Packager counters and schedule, not a mean of equipment OEE values.
