# Live OEE Demo Change and Rollback Notes

## Purpose

This change makes the live Packager and ProductionLine01 OEE stream usable when
telemetry starts after the configured calendar shift begins, and when the
simulator or ingestion resumes after a gap. It also supplies the simulator's
60 bottles/minute ideal rate so performance and OEE can be calculated.

## Changes made

- `app/streaming.py` starts a live calculation at the configured shift boundary
  when there is a fresh baseline for every required signal. If that baseline is
  unavailable, it starts at the first timestamp by which status and all three
  counters are available. It re-anchors after an unplanned telemetry gap or
  cumulative-counter reset. Gaps covered by the configured planned break do not
  cause a re-anchor. Each calculation still ends at its poll time and is stored
  with the existing database insert. Live WebSocket payloads include
  `calculation_start` and `calculation_period` to identify whether the result is
  since the initial start or since recovery.
- `app/config.py` defaults `ideal_rate_per_minute` to 60 for
  `ProductionLine01` and `Packager`. `ASSET_CONFIG_JSON` values override those
  defaults.
- `scripts/oee_hierarchy.sh` is the hierarchy setup script. Its
  `OEE_LINE_VARIABLES` and `OEE_PACKAGER_VARIABLES` arrays explicitly identify
  the status, total, good, and rejected telemetry required by the calculator.
  OEE factors themselves are calculated by the KPI service and are not input
  Asset Model variables.
- The dashboard WebSocket type includes the two calculation-period fields.
- The KPI documentation and `.env.example` describe the defaults. Compose and
  application polling defaults are 7 seconds.

No database schema or persistence behavior was changed. Each completed live
calculation continues to be inserted as before.

## Rollback

If these changes have been committed together, revert that commit with
`git revert <commit>`.

If rolling back from an uncommitted worktree, reverse only the feature changes
listed below. Do not restore whole files: the worktree already contained
separate, previously requested changes to the shift-to-now window and 7-second
polling default.

1. In `app/streaming.py`, remove `_resolve_live_window`, its use in the polling
   loop, and the `calculation_start` / `calculation_period` WebSocket fields.
   Keep the previously requested shift-to-now calculation and 7-second poll.
2. In `app/config.py`, remove `DEFAULT_ASSET_TUNING` and restore the `assets`
   property to parsing `ASSET_CONFIG_JSON` only. Supply explicit ideal rates in
   deployment configuration if OEE is still required.
3. Restore `scripts/oee_hierarchy.sh` to the prior filename
   `scripts/create_production_line_oee_hierarchy.sh` and remove the two OEE
   variable arrays if reverting only the explicit mapping refactor.
4. Remove the optional calculation-period fields from
   `dashboard-service-ui/src/app/services/websocket.service.ts` and revert the
   corresponding README and `.env.example` descriptions.
5. Keep polling at 7 seconds unless that separate request is also being
   reversed. Its defaults are in the root and KPI-service Compose files,
   `app/config.py`, and `.env.example`.

Reverting these application changes does not remove Asset Model data or
measurements already stored in the databases. The hierarchy script is not run
automatically by the KPI service.
