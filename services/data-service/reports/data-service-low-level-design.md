# Data Service Low-Level Design

This report describes the implementation-level design of the Data Service. It is
based on the current NestJS modules, TypeORM entities, migrations, HTTP
controllers, NATS consumer, and outbound gRPC client.

## UML Diagram

The renderable PlantUML source is
[`data-service-class-diagram.puml`](data-service-class-diagram.puml).
It shows the module boundary, HTTP query path, NATS ingestion path, Asset Model
gRPC synchronization path, persistence entities, and PostgreSQL/TimescaleDB.

## What the Low-Level Design Should Show

### 1. Component and module structure

- `AppModule` as the composition root.
- `MeasurementsModule` with `MeasurementsController`, `MeasurementsService`,
  and repository factories backed by `DataSource`.
- `NatsModule` with `NatsService` and `MeasurementConsumer`.
- `GrpcModule` with the outbound `AssetModelGrpcService` client registration.
- `HealthController` and the starter root `AppController` as HTTP interface
  components.
- `ConfigModule`, TypeORM configuration, and the dependency direction from
  interfaces to application services to persistence.
- The fact that Data Service is a gRPC client and does not expose a gRPC server.

### 2. Domain and persistence model

- `Measurement` mapped to the `measurements` hypertable.
- Composite primary key `(variable_id, timestamp)`.
- Nullable typed value columns: `numeric_value`, `boolean_value`, and
  `text_value`.
- The invariant that one typed value column is selected according to the
  variable data type.
- `DataServiceVariable` mapped to `data_service_variables` as a local metadata
  cache.
- `asset_variable_id` as the cache primary key, with cached asset ID, name, data
  type, unit, and synchronization timestamp.
- The absence of cross-service foreign keys because Asset Model owns those IDs.
- The TimescaleDB hypertable conversion and the descending
  `(variable_id, timestamp)` query index.
- Explicit TypeORM migrations and `synchronize: false`.

### 3. HTTP API and contracts

- `GET /measurements` for a time-range query.
- `GET /measurements/:assetVariableId/latest` for the most recent value.
- `GET /health` and the starter root endpoint, clearly marked as operational or
  bootstrap endpoints.
- `MeasurementQueryDto` fields, UUID validation, ISO date parsing, and optional
  result limits.
- Response fields: asset variable ID, data type, unit, timestamp, value, and
  range data.
- HTTP error behavior for invalid ranges, unknown variables, and missing latest
  measurements.
- Swagger/OpenAPI metadata configured during HTTP bootstrap.

### 4. Measurement ingestion path

- NATS connection lifecycle owned by `NatsService`.
- Subscription to `industrial.measurements`.
- Payload shape: `{ variable_id, timestamp, value }`.
- Delegation from `NatsService` to `MeasurementConsumer`.
- JSON, UUID, timestamp, metadata, and data-type validation.
- Conversion to the appropriate typed database column.
- Direct measurement insert through the TypeORM `DataSource`.
- Rejection and logging behavior for malformed or unknown messages.
- Shutdown draining of the NATS connection.

### 5. Asset Model synchronization path

- `AssetModelGrpcService` as an outbound client of the Asset Model Service.
- The `GetAssetHierarchy` protobuf operation and returned recursive asset tree.
- `AssetModelSyncService` boot-time synchronization through
  `OnApplicationBootstrap`.
- Recursive hierarchy flattening into cache rows.
- Deduplication by `assetVariableId`.
- Transactional upsert of current rows.
- Deletion of stale cache rows after synchronization.
- Failure behavior when the remote Asset Model call or database transaction fails.
- The distinction between authoritative Asset Model data and the Data Service's
  query/ingestion cache.

### 6. Query behavior

- Metadata lookup before querying measurements.
- Time-range validation requiring `from <= to`.
- Ascending timestamp ordering for range results.
- Optional query limit.
- Descending latest-value lookup.
- Normalization of nullable typed columns into a single API `value` field.
- Not-found behavior for unknown asset variables and variables without readings.

### 7. Database and migration design

- Migration order and dependency assumptions:
  `measurements`, `data_service_variables`, then cache-key correction.
- Table and column mappings from TypeORM entities.
- Composite primary key and query index definitions.
- TimescaleDB-specific `create_hypertable` behavior.
- Reversible migration operations where practical.
- No database-level validation of the external Asset Model relationship; the
  consumer and synchronization service enforce the application boundary.
- Environment-based PostgreSQL connection settings.

### 8. Sequence diagrams for important flows

The complete LLD should include sequence diagrams for:

- Service startup and Asset Model metadata synchronization.
- Receiving and persisting a valid NATS measurement.
- Rejecting an invalid measurement message.
- Querying measurements over a time range.
- Querying the latest measurement.
- Handling a missing variable metadata row.
- NATS shutdown and connection draining.

Each sequence should show the caller or transport, controller/service, cache or
measurement repository, database, and the success/error path.

### 9. Error and validation matrix

| Condition | Validation owner | Expected result |
| --- | --- | --- |
| Malformed JSON payload | `MeasurementConsumer` | Reject and log |
| Missing or invalid `variable_id` | `MeasurementConsumer` | Reject and log |
| Invalid timestamp | `MeasurementConsumer` | Reject and log |
| Unknown Asset Variable | Consumer or query service | Reject, or HTTP 404 |
| Value does not match `data_type` | `MeasurementConsumer` | Reject and log |
| `from` later than `to` | `MeasurementsService` | HTTP 400 |
| No measurement for known variable | `MeasurementsService` | HTTP 404 |
| Asset Model synchronization failure | `AssetModelSyncService` | Log and fail bootstrap |
| NATS connection failure | `NatsService` | Log; HTTP service remains explicit about ingestion status |
| Duplicate `(variable_id, timestamp)` | Database primary key | Insert failure and log |

### 10. Operational, security, and quality concerns

- Configuration through environment variables such as database and NATS URLs.
- `synchronize: false` with migrations applied separately from application boot.
- Stateless HTTP and NATS processing suitable for multiple replicas, subject to
  deployment-level message delivery and duplicate handling decisions.
- Health/readiness behavior for HTTP, PostgreSQL, NATS, and Asset Model
  synchronization dependencies.
- Structured logs and correlation identifiers for ingestion and synchronization.
- Authentication and authorization for measurement queries and operational
  endpoints.
- Input validation, payload size limits, and protection of infrastructure
  details in error responses.
- Retention, partitioning, and indexing policy for time-series data.
- Observability for ingestion rejection rate, synchronization duration, query
  latency, and database failures.

## Current Implementation and Test Coverage

Implemented and covered by focused tests:

- Measurement range and latest queries, normalization, and validation.
- HTTP controller validation and delegation.
- NATS message validation and typed-value conversion.
- Recursive Asset Model synchronization, deduplication, stale-row deletion,
  and bootstrap synchronization.

Implemented but requiring additional focused tests:

- `NatsService` connection, subscription, and shutdown lifecycle.
- `AssetModelGrpcService` client initialization and remote-call failures.
- TypeORM migrations and TimescaleDB behavior.
- PostgreSQL integration for inserts, composite-key conflicts, and query plans.
- Health/readiness behavior for external dependencies.

The diagram and this report should distinguish current implementation from
planned operational controls; the latter should not be presented as already
implemented.
