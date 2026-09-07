# Data Service Change Log

## Summary

The Data Service contains the persistence foundation for time-series measurements, a configured NestJS gRPC client for the Asset Model Service, and a startup-synchronized local cache of Asset Model variable metadata. PostgreSQL/TimescaleDB is accessed through TypeORM migrations, and the gRPC proto is included in both source and compiled application output.

This record documents the state verified in `services/data-service` on 2026-09-05. The service subtree has no usable commit history, so historical claims that cannot be established from repository state are marked explicitly.

## Motivation

The Data Service needs a dedicated PostgreSQL database for measurements while preserving the Asset Model Service as the source of truth for assets, hierarchy, variables, types, and units. TimescaleDB provides the time-series storage primitive, and the gRPC client provides the integration boundary for the startup metadata snapshot.

## 2026-09-05 - Change 2: Startup Asset Model Metadata Synchronization

### Changes

- Added the `DataServiceVariable` TypeORM entity for the `data_service_variables` cache table.
- Added migration `1788600158360-CreateDataServiceVariables`, with columns `variable_id`, `asset_id`, `name`, `data_type`, `unit`, and `updated_at`.
- Added the composite primary key `(variable_id, asset_id)` so one variable definition can be represented for multiple assets.
- Added `AssetModelSyncService`, invoked through `OnApplicationBootstrap` after database initialization.
- The service fetches the complete hierarchy through `AssetModelGrpcService.getAssetHierarchy()`, recursively traverses roots and nested children, and maps every asset-variable relationship.
- Current relationships are upserted by `(variable_id, asset_id)` and rows absent from the latest complete hierarchy are deleted in the same database transaction.
- Synchronization errors are logged and rethrown so application startup fails rather than continuing with stale or empty metadata.
- Removed the temporary `/grpc-test/asset-hierarchy` controller; the gRPC client remains available as the reusable integration component.

### Files Created or Modified

- Created `src/database/entities/data-service-variable.entity.ts`.
- Created `src/database/migrations/1788600158360-CreateDataServiceVariables.ts`.
- Created `src/asset-model/asset-model-sync.service.ts` and its focused test.
- Modified `src/app.module.ts`, `src/grpc/asset-model-grpc.service.ts`, and `src/grpc/grpc.module.ts`.
- Removed `src/grpc/grpc-test.controller.ts`.
- Updated this changelog.

### Verification

Commands run from `services/data-service`:

- `npm test -- --runInBand src/asset-model/asset-model-sync.service.spec.ts`: passed, 1 suite and 3 tests.
- `npm run build`: passed.
- `npm test -- --runInBand`: passed, 3 suites and 5 tests.
- `npm run migration:show`: `CreateDataServiceVariables1788600158360` is applied.
- `npm run migration:run`: applied the new migration successfully.
- `docker compose exec -T postgres psql -U postgres -d data_service -c '\\d+ data_service_variables'`: confirmed the requested columns and primary key `(variable_id, asset_id)`.
- `PORT=3001 npm run start:prod`: Data Service started while Asset Model was listening on gRPC port `50051`, synchronized 3 relationships, and then completed application startup.
- A live query returned 3 cache rows, including the same variable definition associated with two asset IDs, confirming nested and shared asset-variable metadata.
- Host `psql` was unavailable; the live database checks were executed through the running PostgreSQL container.

### Remaining or Not Implemented

Asset Model change notifications are intentionally not implemented. Time-series REST APIs, connector/PLC logic, data mapping, and anomaly detection remain out of scope.

## 2026-09-06 - Change 3: AssetVariable-Keyed Measurement Ingestion

### Changes

- Changed `data_service_variables` from composite key `(variable_id, asset_id)` to `asset_variable_id UUID PRIMARY KEY`; the value is `AssetVariable.id`, not `VariableDefinition.id`.
- Added migration `1788600158361-UseAssetVariableIdForCache`. It renames the legacy identifier column, removes duplicate legacy identifiers before adding the new primary key, and preserves one deterministic row per identifier. The next startup synchronization restores the complete authoritative relationship set from Asset Model gRPC.
- Updated `DataServiceVariable` and `AssetModelSyncService` so recursive hierarchy synchronization upserts by `assetVariableId` and removes stale rows by `asset_variable_id` while retaining each asset ID.
- Added a NATS client subscriber for `industrial.measurements`, configured with `NATS_URL` and the three-field contract `variable_id`, `timestamp`, and `value`.
- Added metadata lookup through `data_service_variables` and typed persistence to the existing `measurements` columns: FLOAT/INTEGER to `numeric_value`, BOOLEAN to `boolean_value`, and STRING to `text_value`.
- Added validation and diagnostic logging for malformed JSON, invalid UUIDs or timestamps, missing values, unknown AssetVariables, type mismatches, and database insert failures. Invalid messages are rejected without crashing the service.

### Files Created or Modified

- Created `src/database/migrations/1788600158361-UseAssetVariableIdForCache.ts`.
- Created `src/nats/nats.module.ts`, `src/nats/nats.service.ts`, `src/nats/measurement.consumer.ts`, and the focused consumer test.
- Created `src/nats/measurement.consumer.spec.ts`.
- Modified `src/database/entities/data-service-variable.entity.ts`, `src/asset-model/asset-model-sync.service.ts`, its focused test, `src/app.module.ts`, `.env.example`, `package.json`, and `package-lock.json`.
- Updated this changelog.

### Verification

- `npm run build`: passed.
- `npm test -- --runInBand`: passed, 4 suites and 12 tests.
- Focused synchronization and measurement tests: passed, 2 suites and 10 tests.
- Initial migration attempt correctly rolled back on duplicate legacy identifiers; the migration was then updated to handle that existing data shape before adding the new primary key.
- NATS live verification was not performed because broker infrastructure is not part of this change.

### Scope and Assumptions

NATS broker/server infrastructure was **not** implemented; an external broker must provide `NATS_URL`. Connector implementation and PLC/protocol mapping remain out of scope. Legacy duplicate cache rows cannot all remain under the new single-column primary key without an AssetVariable mapping, so the migration retains one row per identifier and the Asset Model startup synchronization repopulates the authoritative relationships.

## 2026-09-06 - Change 4: Measurement Query REST API

### Changes

- Added `GET /measurements` for one `AssetVariable.id` over an inclusive `from`/`to` ISO timestamp range.
- Added optional `limit`, validated as a positive integer with a maximum of 10,000. Limited range results remain ordered by `timestamp ASC` and return the earliest matching records.
- Added `GET /measurements/:asset_variable_id/latest`, which uses descending timestamp order and returns HTTP 404 when no measurement exists.
- Added a repository-backed `MeasurementsService` and kept database query logic out of the controller.
- Both endpoints validate the local `data_service_variables` cache before querying measurements and return HTTP 404 for unknown AssetVariables without calling Asset Model gRPC.
- Responses normalize `numeric_value`, `boolean_value`, and `text_value` to `value`; database-specific value columns are not exposed. Cached `data_type` and `unit` are included as response metadata.
- The existing `(variable_id, timestamp DESC)` index and measurements hypertable are used; no schema migration was required.

### Files Created or Modified

- Created `src/database/entities/measurement.entity.ts`.
- Created `src/measurements/dto/measurement-query.dto.ts`, `src/measurements/measurements.service.ts`, `src/measurements/measurements.controller.ts`, `src/measurements/measurements.module.ts`, and focused tests.
- Modified `src/app.module.ts`, `src/main.ts`, `package.json`, and `package-lock.json`.
- Updated this changelog.

### Verification

- Focused query service tests: passed, 8 tests.
- HTTP validation tests: passed, 7 tests.
- `npm run build`: passed.
- `npm test -- --runInBand`: passed, 6 suites and 27 tests.
- Live smoke test passed with a temporary measurement: range and latest returned HTTP 200, invalid UUID returned HTTP 400, empty range returned HTTP 200 with `data: []`, latest without data returned HTTP 404, and unknown AssetVariable returned HTTP 404. The temporary row was removed afterward.
- Startup synchronization was verified against the running Asset Model Service; duplicate canonical IDs were collapsed before upsert so the single-column cache key remains valid.
- Swagger was not added because no Swagger setup exists in the current Data Service.

### Remaining or Not Implemented

Aggregation, pagination, multi-variable queries, advanced filtering, anomaly detection, and dashboard implementation remain out of scope. Anomaly detection remains a downstream consumer, and dashboards remain outside the Data Service.

## Changes

| Area | What changed | Why | Location | Verification |
|---|---|---|---|---|
| Database configuration | TypeORM uses environment-provided PostgreSQL connection settings with `synchronize: false`. | Schema changes must be explicit and migration-controlled. | `src/app.module.ts`, `src/database/data-source.ts` | `npm run build`; `npm run migration:show`; `npm run migration:run` |
| Migration setup | TypeORM CLI scripts and a `CreateMeasurements1788600158359` migration are present. | Provide repeatable, reversible schema management. | `package.json`, `src/database/migrations/1788600158359-CreateMeasurements.ts` | Migration discovered and already applied; no migrations pending. |
| Measurements storage | The migration creates a TimescaleDB hypertable and a variable/time query index. | Store timestamped values efficiently while supporting variable history queries. | `src/database/migrations/1788600158359-CreateMeasurements.ts` | Live database inspection confirmed the hypertable and indexes. |
| gRPC client | A NestJS gRPC client named `ASSET_MODEL_SERVICE` is registered. | Establish the future Asset Model integration boundary. | `src/grpc/grpc.module.ts`, `src/app.module.ts` | Build and compiled application startup succeeded. |
| Proto build asset | The proto path is relative to the compiled gRPC module, and Nest copies proto assets into `dist`. | Prevent production startup from resolving a nonexistent `dist/grpc/grpc/proto` path. | `src/grpc/grpc.module.ts`, `nest-cli.json` | `dist/grpc/proto/asset-model.proto` exists after build; startup succeeds. |

Historical previous states for the database, migration, dependency, and configuration changes are not established from repository state because the service repository has no usable commit history.

## Files Created

- `src/database/migrations/1788600158359-CreateMeasurements.ts`: Creates and reverses the `measurements` table, TimescaleDB hypertable, and variable/time index. Whether this file was newly created during the documented work is not established from repository state.
- `src/grpc/proto/asset-model.proto`: Defines the Asset Model gRPC contract used by the client. Whether this file was newly created during the documented work is not established from repository state.
- `docs/changelogs/data-service-2026-09-05.md`: This machine-readable operational record.

## Files Modified

- `src/app.module.ts`: Imports configuration, the gRPC client module, and TypeORM with environment-based PostgreSQL settings and `synchronize: false`. Historical modification status is not established from repository state.
- `src/database/data-source.ts`: Loads dotenv configuration and defines TypeORM entity and migration globs with synchronization disabled. Historical modification status is not established from repository state.
- `src/grpc/grpc.module.ts`: Registers the `ASSET_MODEL_SERVICE` gRPC client and resolves the proto beside the compiled module.
- `nest-cli.json`: Configures Nest to copy `grpc/proto/**/*.proto` into the build output and watch the assets.
- `package.json`: Contains the TypeORM migration scripts, dotenv dependency, and gRPC dependencies. Historical modification status is not established from repository state.
- `package-lock.json`: Locks the dependencies declared by `package.json`. Historical modification status is not established from repository state.

No files outside `services/data-service` were changed for this record.

## Database Changes

- **Database name:** `data_service`, configured through `DATABASE_NAME`. The Asset Model Service database remains a separate concern and is not modified by this work.
- **Database engine:** PostgreSQL with TimescaleDB.
- **TimescaleDB version verified:** `2.29.2`.
- **Table:** `measurements`.
- **Columns:**
  - `variable_id UUID NOT NULL`
  - `timestamp TIMESTAMPTZ NOT NULL`
  - `numeric_value DOUBLE PRECISION NULL`
  - `boolean_value BOOLEAN NULL`
  - `text_value TEXT NULL`
- **Hypertable:** `measurements`, using `timestamp` as the time dimension through `create_hypertable('measurements', 'timestamp', if_not_exists => TRUE)`.
- **Application query index:** `(variable_id, timestamp DESC)`, named `IDX_measurements_variable_id_timestamp`.
- **TimescaleDB index verified:** `measurements_timestamp_idx`.
- **Uniqueness:** There is intentionally no unique constraint on `(variable_id, timestamp)`; duplicate timestamps for a variable are allowed.
- **Value mapping:** `FLOAT` and `INTEGER` map to `numeric_value`; `BOOLEAN` maps to `boolean_value`; `STRING` maps to `text_value`.
- **Rollback:** The migration drops the application index and `measurements` table. TypeORM migration rollback must be used; the PostgreSQL/TimescaleDB volume must not be deleted.

## gRPC Changes

- **Proto location:** `src/grpc/proto/asset-model.proto`.
- **Service:** `AssetModelService`.
- **RPC declared:** `GetAssetHierarchy(GetAssetHierarchyRequest) returns (GetAssetHierarchyResponse)`.
- **Package:** `assetmodel`.
- **Configured address:** `ASSET_MODEL_GRPC_URL`, defaulting to `localhost:50051`; `.env.example` documents `ASSET_MODEL_GRPC_URL=localhost:50051`.
- **Dependencies:** `@grpc/grpc-js`, `@grpc/proto-loader`, and NestJS microservices support.
- **Implemented:** NestJS client registration through `src/grpc/grpc.module.ts`; proto asset copying for compiled output.
- **Implemented:** `AssetModelGrpcService.getAssetHierarchy()` invokes `GetAssetHierarchy()` and returns the complete root hierarchy for startup synchronization.

## Configuration Changes

Relevant variables are documented in `.env.example` and loaded by the application/data source:

- `PORT`
- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME=data_service`
- `ASSET_MODEL_GRPC_URL`

Actual secrets are not recorded here. The repository-level Docker Compose and `.env` infrastructure are outside this service-only change scope; their historical modifications are not established from the `services/data-service` subtree.

## Verification

Executed from `services/data-service` on 2026-09-05:

- **TypeScript/Nest build:** `npm run build` passed.
- **Tests:** `npm test -- --runInBand` passed: 2 suites and 2 tests.
- **TypeORM CLI:** `npm run migration:show` discovered `CreateMeasurements1788600158359` and marked it applied.
- **Migration status/execution:** `npm run migration:run` completed with `No migrations are pending`.
- **TimescaleDB:** live PostgreSQL query returned version `2.29.2`.
- **Hypertable:** live query confirmed `measurements` is a TimescaleDB hypertable.
- **Indexes:** live query confirmed `IDX_measurements_variable_id_timestamp` and `measurements_timestamp_idx`.
- **gRPC build verification:** build emitted `dist/grpc/proto/asset-model.proto`.
- **gRPC client startup verification:** `npm run start:prod` initialized `GrpcModule` and `ClientsModule` successfully without a proto-definition error.

The current repository state does not provide evidence for a separate historical test run, migration execution, or dependency-removal event beyond the checks recorded above.

## Architectural Decisions

- Asset Model Service remains the source of truth for assets, hierarchy, variables, variable types, and units.
- Data Service uses a separate logical database, `data_service`; it must not be merged with the Asset Model Service database.
- TypeORM migrations are authoritative; `synchronize` remains disabled.
- Measurements use typed nullable value columns rather than a generic `any` column.
- Multiple measurements with the same `(variable_id, timestamp)` are allowed.
- The local variable metadata cache is not a source of truth; it is refreshed once during startup from the complete Asset Model hierarchy.
- Asset Model changes are not notified to Data Service yet; `GetAssetHierarchy()` remains the planned retrieval mechanism.
- The gRPC integration is a client boundary only at this stage.

## Explicitly Out of Scope

The following must not be inferred as implemented:

- NATS or any notification/event mechanism.
- Asset Model change notifications.
- REST aggregation, pagination, multi-variable queries, and advanced filtering.
- Connector logic.
- Physical PLC or industrial protocol integration.
- Changes to the Asset Model Service.

## Rollback Instructions

### Code rollback

1. Inspect the current worktree and confirm each target belongs to the documented Data Service changes.
2. Revert or remove only the documented Data Service changes. Candidate files are:
   - `src/grpc/grpc.module.ts` for the gRPC client registration/path change.
   - `nest-cli.json` for proto asset copying.
   - `src/app.module.ts` and `src/database/data-source.ts` for the TypeORM configuration, only after confirming their prior contents.
   - `src/database/migrations/1788600158359-CreateMeasurements.ts` if the migration itself must be removed and it has not been applied.
   - `src/grpc/proto/asset-model.proto` if the proto is no longer required.
2. Remove the generated `dist` output only as a local build cleanup if needed; do not remove source files or unrelated work automatically.
3. Do not modify or revert Asset Model Service files.
4. Do not delete this changelog until the rollback has been reviewed and recorded elsewhere if an audit trail is required.

### Dependency rollback

1. Inspect `package.json` and `package-lock.json` before changing them.
2. Revert only dependencies demonstrably introduced for the documented work, including `@grpc/grpc-js`, `@grpc/proto-loader`, `dotenv`, and any Nest microservices/TypeORM migration support that was not previously present.
3. The historical removal of `typeorm-ts-node-commonjs` is not established from repository state; do not re-add it automatically.
4. Run `npm install` or the repository-approved lockfile update procedure after any dependency change, then rerun build and tests.

### Database rollback

1. Confirm the migration is the latest applied migration with `npm run migration:show`.
2. From `services/data-service`, run `npm run migration:revert` once to invoke the migration's `down` method.
3. Verify that only the documented `measurements` objects were affected.
4. Do not delete the PostgreSQL/TimescaleDB database, container, or persistent volume. Do not roll back the Asset Model Service database.
5. If later migrations exist, follow TypeORM's ordered rollback process and review each migration before reverting it.

### Configuration rollback

1. Inspect `.env.example`, `.env`, and any service-owned configuration before editing them.
2. Remove or revert only the Data Service entries for `DATABASE_*`, `DATABASE_NAME=data_service`, and `ASSET_MODEL_GRPC_URL` if those entries were introduced by this work.
3. Do not record, print, or commit values from `.env`; preserve secrets.
4. Repository-level Docker Compose changes are outside this service-only rollback and must not be changed from this document alone.

## AI Agent Instructions

- Do not assume these changes are present if files differ; inspect the repository first.
- Treat this document as an operational record, not proof of historical changes where the repository cannot establish them.
- Do not delete unrelated work or overwrite user changes.
- Do not destroy databases, containers, or Docker volumes.
- Use `npm run migration:revert` for database rollback where appropriate; do not manually drop the database.
- Preserve Asset Model Service data and configuration.
- Only revert changes documented in this changelog, after checking current file contents and migration order.
- Do not implement the out-of-scope functionality listed above as part of a rollback or documentation update.
