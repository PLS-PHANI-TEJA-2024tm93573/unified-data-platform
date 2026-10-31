# Asset Model Service Low-Level Design

This report describes the implementation-level views that should accompany the
Asset Model Service. The source of truth for the current model is the NestJS
implementation and TypeORM migrations in `src/`.

## UML Class Diagram

The renderable PlantUML source is
[`asset-model-service-class-diagram.puml`](asset-model-service-class-diagram.puml).
It shows the domain entities, association entities, service/controller layers,
and the PostgreSQL persistence boundary.

## What the Low-Level Design Should Show

### 1. Component and module structure

- `AppModule` as the composition root.
- `DatabaseModule` and the TypeORM `DataSource`.
- `AssetTypesModule`, `VariablesModule`, and `AssetsModule`.
- Each module's controllers, DTOs, services, and entities.
- The dependency direction: controller -> service -> repository -> TypeORM -> PostgreSQL.
- The gRPC controller boundary used for asset access.

### 2. Domain and persistence model

- `AssetType` and its unique name.
- `VariableDefinition` and its unique name, data type, and unit.
- `AssetTypeVariable` as an explicit association with `required`.
- `Asset` with a required asset type and optional `parent_asset_id` self-reference.
- `AssetVariable` as an explicit association with `isCustom`.
- Primary keys, foreign keys, nullable fields, timestamp columns, and JSONB metadata.
- Unique constraints on `(asset_type_id, variable_definition_id)` and
  `(asset_id, variable_definition_id)`.
- Indexes and migration order for dependency-safe schema creation.

### 3. API and contract design

- REST routes for asset types, variable definitions, and assets.
- gRPC operations and the protobuf contract for cross-service asset access.
- Request DTOs, update DTOs, validation rules, and response shapes.
- HTTP/gRPC status mapping for not-found, conflict, and invalid-request cases.
- The rule that persistence entities are not exposed as long-term public API contracts.

### 4. Application and domain behavior

- Asset type creation, update, lookup, and deletion.
- Variable definition creation, update, lookup, and deletion.
- Association creation/removal and duplicate detection.
- Asset creation, update, lookup, hierarchy traversal, and deletion.
- Validation of asset type and variable references.
- Prevention of self-parenting and circular asset hierarchies.
- Prevention of deleting records with dependent assets or associations.
- Validation that assigned variables are allowed by the asset type.
- Transaction boundaries for multi-step operations that must be atomic.

### 5. Database and migration design

- Tables: `asset_types`, `variable_definitions`, `asset_type_variables`,
  `assets`, and `asset_variables`.
- Column-to-property mappings, including snake_case foreign-key columns.
- Foreign-key delete/update behavior and the absence of destructive cascade deletes.
- Explicit unique constraints and query indexes.
- Reversible migrations in dependency order.
- `synchronize: false` and environment-based database configuration.

### 6. Sequence diagrams for important flows

The LLD should include sequence diagrams for:

- Creating an asset type.
- Adding a variable definition to an asset type.
- Creating an asset with a parent asset.
- Assigning a variable to an asset.
- Changing an asset's type while checking assigned-variable compatibility.
- Removing an asset type or variable definition with dependent records.
- Reading the asset hierarchy through REST or gRPC.

Each sequence should show the controller, service, repository, database, and
the error response path.

### 7. Error and validation matrix

Document the condition, validation owner, and returned error for:

| Condition | Owner | Expected result |
| --- | --- | --- |
| Duplicate asset type or variable name | Service and database constraint | Conflict |
| Missing referenced asset type or variable | Service | Not found |
| Duplicate association | Service and unique constraint | Conflict |
| Asset is its own parent | Service | Bad request |
| Asset hierarchy cycle | Service/domain validation | Bad request or conflict |
| Delete with dependent records | Service | Conflict |
| Variable not allowed by asset type | Service | Conflict |

### 8. Operational and quality concerns

- Configuration through environment variables.
- Stateless service behavior suitable for multiple replicas.
- Structured logging and request correlation.
- Health/readiness checks and database failure handling.
- Unit tests for domain rules, integration tests for repositories, and e2e tests
  for REST/gRPC contracts.
- Migration execution and rollback procedure.
- Security controls for authentication, authorization, input validation, and
  sensitive metadata handling.

## Current Implementation Notes

- The entities and TypeORM data source currently implement the five-entity model.
- `AssetTypeVariable` and `AssetVariable` are explicit association entities and
  must remain so because they carry domain attributes.
- `Asset.metadata` is JSONB for descriptive metadata only; telemetry belongs to
  the separate data/time-series service.
- The service currently contains REST and gRPC controller surfaces, so both
  contracts should be represented in the completed LLD.
- The LLD should mark any planned controls, such as full circular-hierarchy
  detection or authentication, as pending rather than implying they already
  exist.