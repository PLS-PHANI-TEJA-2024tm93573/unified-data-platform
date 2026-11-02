# Configuration

All settings are environment variables. `.env.example` contains placeholder/local defaults; the service does not load `.env` automatically, so export values or use a local dotenv runner.

| Variable | Default | Required | Meaning |
|---|---|---|---|
| `PORT` | `8090` | No | HTTP listen port. |
| `NATS_URL` | `nats://localhost:4222` | No | Existing Core NATS endpoint. |
| `METADATA_MODE` | `fixture` | No | `fixture` demo IDs or read-only `asset-model`. |
| `ASSET_MODEL_URL` | `http://localhost:3000` | For Asset Model mode | Asset Model base URL. |
| `SIM_TICK_MS` | `1000` | No | Tick interval, minimum 50 ms. |
| `SIM_SPEED` | `1` | No | Virtual-time multiplier (> 0). |
| `SIM_SEED` | `42` | No | Deterministic random seed. |
| `AUTO_START` | `false` | No | Start at process boot when `true`. |
| `PUBLISH_INTERVAL_TICKS` | `1` | No | Production snapshot cadence in ticks. |

HTTP configuration also includes `idealRatePerMinute=60`, `shiftMinutes=480`, `plannedBreakMinutes=30`, `rejectProbability=0.02`, `defectDistribution` (equal weights across four categories), `faultProbabilityPerTick=0.001`, `jamProbabilityPerTick=0.0005`, `speedMinFactor=0.9`, `speedMaxFactor=1`, and `setupCountsAsDowntime=true`. `PUT /api/v1/simulation/config` accepts these fields. Updates are rejected while running; pause or stop first. In-memory counters and config are not persisted across process restart. NATS URLs are logged only on connect failure; credentials should be supplied through deployment secrets and never committed.
