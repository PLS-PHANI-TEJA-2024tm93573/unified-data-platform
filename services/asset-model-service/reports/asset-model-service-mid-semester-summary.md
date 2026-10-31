# Asset Model Service: Mid-Semester Report Summary

## 1. Service Overview

The Asset Model Service is a backend service responsible for defining,
managing, and exposing the structural model of industrial assets. It stores
asset types, variable definitions, individual assets, asset hierarchies, and
the relationships between assets and variables.

The service is implemented using NestJS, TypeScript, TypeORM, and PostgreSQL.
It provides REST-based resource management and a gRPC interface for retrieving
the complete asset hierarchy.

The service manages asset structure and metadata only. Time-series telemetry
measurements are handled by a separate data service.

## 2. Primary Features

### 2.1 Asset Type Management

The service supports creation, modification, retrieval, and deletion of asset
types. An asset type represents a reusable category or template, such as a
plant, machine, motor, or sensor.

### 2.2 Variable Definition Management

Variable definitions represent reusable properties of assets, such as
temperature, pressure, speed, or operating status. Each definition contains a
name, data type, unit, and optional description.

### 2.3 Asset Management

The service manages individual assets and associates each asset with an asset
type. Assets may contain descriptive fields such as name, location,
description, and flexible JSONB metadata.

### 2.4 Asset Hierarchy Management

Assets can have parent-child relationships. This allows industrial structures
to be represented as a hierarchy:

```text
Plant
└── Production Line
    └── Machine
        └── Motor
```

### 2.5 Asset Type Variable Associations

The `AssetTypeVariable` association defines which variables are valid for an
asset type. It also records whether a variable is required or optional.

### 2.6 Asset Variable Associations

The `AssetVariable` association assigns valid variables to individual assets.
It contains the `isCustom` property for asset-specific variable behavior.

### 2.7 Validation and Data Integrity

The service validates asset type and variable references, prevents duplicate
associations, prevents self-parenting, and restricts deletion when dependent
records exist. Variables assigned to an asset must be permitted by its asset
type.

### 2.8 Persistence and Migration Management

PostgreSQL stores the domain data through TypeORM entities and explicit
migrations. The design uses UUID primary keys, foreign keys, unique
constraints, timestamps, and JSONB metadata.

### 2.9 gRPC Hierarchy Retrieval

The gRPC interface provides an `GetAssetHierarchy` operation. It returns root
assets together with their asset types, variables, and child assets in a nested
structure for use by other services.

## 3. Core Domain Entities

The service contains five primary entities:

| Entity | Responsibility |
| --- | --- |
| `AssetType` | Defines a reusable category or template for assets. |
| `VariableDefinition` | Defines a reusable variable, data type, and unit. |
| `AssetTypeVariable` | Associates a variable definition with an asset type and records `required`. |
| `Asset` | Represents an actual industrial asset and its hierarchy position. |
| `AssetVariable` | Associates a variable definition with an asset and records `isCustom`. |

The association entities are explicit entities because they contain domain
attributes. They should not be replaced by simple many-to-many relationships.

## 4. Recommended Low-Level Design Section

The following headings are recommended for the Low-Level Design section of an
M.Tech-level mid-semester report.

### 4.1 Low-Level Design Objectives

Explain that the LLD converts the high-level architecture into implementable
details, including classes, modules, database structures, APIs, validation
rules, and processing flows.

### 4.2 Technology and Implementation Stack

Document the selected technologies and their purpose:

| Layer | Technology |
| --- | --- |
| Backend framework | NestJS |
| Programming language | TypeScript |
| API styles | REST and gRPC |
| ORM | TypeORM |
| Database | PostgreSQL |
| Testing | Jest and Supertest |
| Configuration | Environment variables |
| Schema management | TypeORM migrations |

Explain the architectural reasons for selecting the framework, ORM, database,
and communication protocols.

### 4.3 Module-Level Design

Describe the responsibility and dependencies of:

- `AppModule`
- `DatabaseModule`
- `AssetTypesModule`
- `VariablesModule`
- `AssetsModule`

Show the following dependency flow:

```text
Controller
    ↓
Application / Domain Service
    ↓
TypeORM Repository
    ↓
PostgreSQL
```

### 4.4 Domain Model Design

Describe the attributes, responsibility, and relationships of all five domain
entities. Explain the purpose of the association entities and the self-
referencing relationship used to construct the asset hierarchy.

### 4.5 UML Class Diagram

Include a UML diagram showing:

- Entity attributes
- Primary keys and foreign keys
- Relationships and cardinalities
- Association entities
- Asset parent-child relationships
- Services and controllers
- PostgreSQL persistence boundary

The PlantUML source is available in
[`asset-model-service-class-diagram.puml`](asset-model-service-class-diagram.puml).

### 4.6 Database Design

Describe the following tables:

```text
asset_types
variable_definitions
asset_type_variables
assets
asset_variables
```

Document primary keys, foreign keys, nullable fields, timestamps, JSONB
metadata, unique constraints, indexes, and delete behavior.

Important uniqueness rules are:

```text
UNIQUE(asset_type_id, variable_definition_id)
UNIQUE(asset_id, variable_definition_id)
```

### 4.7 API and Interface Design

Document the REST resources and the gRPC interface. Include endpoint names,
HTTP methods, DTOs, request and response structures, validation rules, error
responses, and protobuf messages.

The current gRPC operation is:

```text
GetAssetHierarchy()
```

### 4.8 Service and Business Logic Design

Explain the responsibilities of:

- `AssetTypeService`
- `VariableDefinitionService`
- `AssetService`

Document rules such as unique names, valid references, duplicate prevention,
asset type compatibility, parent validation, and deletion restrictions.

### 4.9 Sequence Diagrams

Include sequence diagrams for the following operations:

1. Create an asset type.
2. Create a variable definition.
3. Add a variable to an asset type.
4. Create an asset with a parent asset.
5. Assign a variable to an asset.
6. Retrieve the asset hierarchy.
7. Delete an entity with dependent records.
8. Change an asset's type.

Each sequence should show the client, controller, service, repository, database,
success path, and failure path.

### 4.10 Validation and Error Handling

Include a validation matrix such as:

| Scenario | Expected result |
| --- | --- |
| Duplicate asset type or variable name | Conflict |
| Missing asset type or variable definition | Not found |
| Duplicate association | Conflict |
| Asset assigned as its own parent | Bad request |
| Asset assigned an invalid variable | Conflict |
| Deletion with dependent records | Conflict |
| Circular hierarchy | Bad request or conflict |

The report should clearly identify which rules are currently implemented and
which are planned enhancements.

### 4.11 Database Migration Design

Explain the use of `synchronize: false`, explicit migrations, rollback
procedures, foreign-key dependencies, and safe schema evolution.

The recommended migration order is:

```text
1. asset_types
2. variable_definitions
3. asset_type_variables
4. assets
5. asset_variables
```

### 4.12 Testing Strategy

Describe the testing layers:

- Unit tests for service and domain rules.
- Integration tests for repositories and database behavior.
- End-to-end tests for REST APIs.
- Contract tests for gRPC communication.

Tests should verify business behavior and architectural constraints rather than
only increasing code coverage.

### 4.13 Security and Operational Design

Include authentication, authorization, input validation, metadata protection,
environment-based configuration, database credential management, logging,
request tracing, health checks, readiness checks, and stateless deployment.

### 4.14 Limitations and Future Enhancements

Identify incomplete or planned capabilities, such as:

- Full circular hierarchy detection.
- Authentication and authorization.
- Complete DTO validation.
- Swagger/OpenAPI documentation.
- Expanded gRPC operations.
- Production observability.
- Deployment automation.
- Integration with the time-series service.

This distinction demonstrates research awareness and prevents planned features
from being presented as completed functionality.

## 5. Conclusion

The Asset Model Service establishes the structural foundation for an
industrial asset platform. It separates asset definitions from telemetry
storage, models asset hierarchies explicitly, and enforces relationships
between asset types, variables, and assets. Its modular NestJS design and
relational PostgreSQL model provide a suitable foundation for later expansion,
including additional APIs, validation, observability, and integration with
other platform services.