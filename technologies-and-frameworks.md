# Technologies and Frameworks

The current implementation comprises an Asset Model Service and a Data Service. The Asset Model Service manages asset definitions and hierarchies, while the Data Service receives, stores, and queries telemetry measurements. PLC acquisition and protocol integration are outside the present dissertation scope.

## 1. Programming Languages

### TypeScript

TypeScript is the principal implementation language for both NestJS services. It is used for REST controllers and application services, TypeORM entities and migrations, gRPC clients and controllers, NATS message consumption, DTOs, validation logic, and automated tests.

The use of TypeScript provides static typing for service interfaces, data-transfer objects, persistence models, and inter-service communication.

### JavaScript

JavaScript is used by the simulator implementation. The simulator acts as an edge-side measurement producer for development and testing by publishing generated measurements to NATS. It is not treated as a separate platform service in the implemented dissertation architecture.

### SQL

SQL is embedded within TypeORM migration files. It is used to create tables, indexes, constraints, PostgreSQL extensions, and the TimescaleDB hypertable used by the Data Service.

### Protocol Buffers

Protocol Buffers are used to define the gRPC contract between the Asset Model Service and the Data Service. The contract is defined in `services/asset-model-service/proto/asset-model.proto` and provides the `GetAssetHierarchy` operation.

### Shell and YAML

Shell scripts are used for development and test setup. YAML is used for Docker Compose configuration and related tooling configuration. These are configuration and automation languages rather than application implementation languages.

## 2. Application Frameworks and Libraries

### NestJS

Both services are implemented using NestJS 11. NestJS provides the modular application structure, dependency injection, controllers, lifecycle hooks, validation pipeline, and service abstractions.

The Asset Model Service contains modules for assets, asset types, variables, and database access. The Data Service contains modules for measurements, NATS integration, gRPC integration, health checks, and database access.

### Express

The services use the Express adapter through `@nestjs/platform-express`. Express provides the HTTP server underneath the NestJS REST APIs.

### REST and OpenAPI

REST APIs are implemented through NestJS controllers. The Asset Model Service exposes resources for asset types, variables, assets, and their associations. The Data Service exposes measurement-query and health endpoints.

OpenAPI documentation is generated using `@nestjs/swagger`. Swagger documentation is configured during application bootstrap in both services.

### TypeORM and PostgreSQL Driver

TypeORM is used as the object-relational mapping and data-access library. It maps TypeScript entities to PostgreSQL tables and provides repositories, database configuration, and migration execution.

The PostgreSQL driver is supplied by the `pg` package. The Asset Model Service uses TypeORM entities for assets, asset types, variable definitions, and association entities. The Data Service uses TypeORM entities for measurements and its local asset-variable metadata cache.

### gRPC

gRPC communication uses NestJS microservices with the gRPC transport. The implementation also includes `@grpc/grpc-js`, `@grpc/proto-loader`, and `@nestjs/microservices`.

The Asset Model Service exposes the `GetAssetHierarchy` gRPC operation. The Data Service acts as the gRPC client and synchronizes asset metadata into its local cache.

### NATS Client

The `nats` Node.js client is used by the Data Service to subscribe to measurement messages. The current implementation subscribes to the subject `industrial.measurements`.

The simulator also uses the NATS client to publish generated measurements. NATS is therefore used for asynchronous measurement transport rather than for database access or REST request handling.

### Validation and Configuration Libraries

The implementation uses:

- `class-validator` for DTO and payload validation
- `class-transformer` for request transformation
- `@nestjs/config` and `dotenv` for environment-based configuration
- `rxjs` for NestJS microservice and gRPC observable handling
- `reflect-metadata` for decorator-based NestJS and TypeORM functionality

## 3. Data Storage Technologies

### PostgreSQL

PostgreSQL is the relational database technology used by both platform services. Database connection properties are supplied through environment variables, including host, port, credentials, and database name.

The Asset Model Service owns the relational representation of:

- asset types
- variable definitions
- asset-type variable associations
- assets
- asset-variable associations

Its schema contains explicit primary keys, foreign keys, unique constraints, indexes, and a self-referencing parent-child relationship for asset hierarchies. Asset descriptive metadata is stored using PostgreSQL JSONB.

The Data Service owns measurement persistence and a local metadata cache. It does not own the authoritative asset model. Instead, asset-variable metadata is retrieved from the Asset Model Service through gRPC and cached locally.

The repository configures both services with `synchronize: false`; schema changes are applied through explicit TypeORM migrations.

### TimescaleDB

The Data Service uses TimescaleDB functionality on top of PostgreSQL. Its migration creates a `measurements` table and converts it into a hypertable using:

```sql
create_hypertable('measurements', 'timestamp')
```

Measurements contain:

- variable identifier
- timestamp
- numeric value
- Boolean value
- textual value

The composite variable-and-timestamp key and descending timestamp index support time-oriented measurement storage and latest-value queries. The implementation stores different supported data types in separate typed columns rather than in an unstructured JSON field.

### Database Ownership

The repository does not establish separate physical database technologies for the two services. Both use PostgreSQL-compatible configuration, while ownership is separated logically:

- Asset Model Service: asset structure and metadata
- Data Service: telemetry measurements and local asset-variable metadata

## 4. Messaging and Service Communication

### NATS

NATS is the asynchronous messaging infrastructure for measurement transport.

The implemented subject is:

```text
industrial.measurements
```

The Data Service subscribes to this subject and validates incoming JSON messages. Validation includes message structure, UUID format, timestamp validity, variable existence, and compatibility between the measurement value and the variable data type.

The simulator publishes generated measurement messages to the same subject. The current implementation does not use NATS for Asset Model lifecycle events.

### gRPC

gRPC is used for internal communication between the Asset Model Service and the Data Service.

- Asset Model Service: gRPC server
- Data Service: gRPC client
- Operation: `GetAssetHierarchy`

The Data Service calls this operation to obtain the asset hierarchy and associated variables, then synchronizes the result into its local metadata cache.

### REST/HTTP

REST over HTTP is used for application-facing APIs.

The Asset Model Service provides REST endpoints for managing asset types, variables, assets, and their relationships. The Data Service provides REST endpoints for querying stored measurements and exposing service health.

Accordingly, the communication roles are:

| Mechanism | Purpose |
|---|---|
| NATS | Asynchronous measurement transport |
| gRPC | Asset Model hierarchy retrieval and metadata synchronization |
| REST/HTTP | Application-facing resource management and measurement queries |

## 5. Containerisation and Infrastructure

### Docker

Docker is used for local infrastructure and simulator execution. The repository contains Docker configuration for NATS and the TimescaleDB/PostgreSQL environment.

An Asset Model Service Dockerfile exists but is empty. No Data Service Dockerfile is currently present. Therefore, the repository does not currently demonstrate complete container images for both NestJS services.

### Docker Compose

The root `docker-compose.yml` defines:

- a TimescaleDB container based on PostgreSQL 17
- a NATS container
- a Node-RED container for local debugging and message-flow testing
- persistent Docker volumes for database and Node-RED data
- an external Docker network named `data-platform-net`

The Compose file does not build or start the Asset Model Service or Data Service containers.

### Node-RED

Node-RED is included as a debug-only local tool in the root Compose file. The Compose comment identifies it as being intended for local message-flow testing rather than as a production platform component.

### Service Containers

No complete container deployment definition exists for the two NestJS services. No Kubernetes manifests, Helm charts, or cloud deployment configuration are present in the current repository.

## 6. Development and Testing Technologies

### TypeScript and NestJS Build Tools

The services use:

- TypeScript
- Nest CLI
- `ts-node`
- `ts-loader`
- `tsconfig-paths`

These tools support compilation, development execution, and TypeScript-based migration execution.

### Testing

Testing is implemented with Jest. The repository also uses:

- `@nestjs/testing` for NestJS testing utilities
- `ts-jest` for TypeScript test transformation
- Supertest for HTTP and end-to-end API testing
- `@types/jest` and `@types/supertest` for type definitions

The tests include unit tests for services and consumers, controller tests, and end-to-end test configurations.

### Linting and Formatting

The repository uses:

- ESLint
- TypeScript ESLint
- Prettier
- `eslint-config-prettier`
- `eslint-plugin-prettier`

These tools are configured for static analysis and source formatting.

### Database Migration Tools

TypeORM migrations are used to create and evolve database schemas. Migration commands include generation, execution, reverting, and status inspection. The migration files define the Asset Model schema, Data Service metadata cache, measurements table, indexes, constraints, and TimescaleDB hypertable.

## 7. Technology Selection Summary

| Technology | Category | Role in the Platform |
|---|---|---|
| TypeScript | Programming language | Implements both platform services |
| JavaScript | Programming language | Implements the development measurement simulator |
| NestJS 11 | Application framework | Provides service modules, dependency injection, controllers, and lifecycle management |
| Express | HTTP framework | Provides the HTTP adapter for REST APIs |
| TypeORM | ORM/data access | Maps entities to PostgreSQL and executes migrations |
| PostgreSQL | Relational database | Stores asset metadata and measurement data |
| TimescaleDB | Time-series database extension | Provides hypertable-based measurement storage |
| NATS | Messaging infrastructure | Transports measurement messages asynchronously |
| gRPC/Protocol Buffers | Service communication | Synchronizes asset hierarchy metadata |
| Jest/Supertest | Testing technologies | Supports unit, integration-oriented, and HTTP tests |
| Docker/Docker Compose | Containerisation | Runs local database, messaging, and debugging infrastructure |
| ESLint/Prettier | Development tooling | Provides linting and formatting |

## 8. Architecture-to-Technology Mapping

| Architectural Component | Technologies |
|---|---|
| Asset Model Service | TypeScript, NestJS, Express, REST, TypeORM, PostgreSQL, Swagger, class-validator |
| Data Service | TypeScript, NestJS, Express, REST, TypeORM, PostgreSQL, TimescaleDB |
| NATS Messaging | NATS server, Node.js NATS client, `industrial.measurements` subject |
| Asset Model Synchronisation | gRPC, Protocol Buffers, NestJS microservices, `@grpc/grpc-js` |
| Time-Series Storage | PostgreSQL, TimescaleDB hypertable, TypeORM migrations |
| Simulator | JavaScript, Node.js, NATS client |
| Anomaly Detection Service | Not implemented in the current repository |
| Deployment Infrastructure | Docker, Docker Compose, TimescaleDB container, NATS container, Node-RED debug container |

## Repository Verification

### Technologies Confirmed

The following were confirmed from package manifests, source code, migrations, and infrastructure files:

- TypeScript
- JavaScript
- SQL embedded in migrations
- NestJS 11
- Express adapter
- TypeORM
- PostgreSQL
- TimescaleDB
- NATS
- gRPC
- Protocol Buffers
- Swagger/OpenAPI generation
- `class-validator`
- `class-transformer`
- Jest
- Supertest
- TypeScript compiler and Nest CLI
- ESLint
- Prettier
- Docker
- Docker Compose
- Node-RED for local debugging

### Technologies Not Currently Implemented

The repository contains no implementation of:

- Kafka
- EMQX
- Redis
- MongoDB
- Prisma
- Kubernetes
- Angular
- cloud deployment infrastructure
- anomaly detection algorithms or service
- PLC or industrial protocol acquisition
- Asset Model lifecycle-event publishing through NATS
- complete Docker service images for both NestJS services

### Ambiguities

The repository configures PostgreSQL access for both services through environment variables, but it does not establish separate physical database instances or provide a complete production deployment configuration. Consequently, database ownership can be described logically by service responsibility, but physical database separation cannot be confirmed.

The simulator is present and publishes measurements to NATS, but it should be treated as a development or future edge-side producer rather than as an independently implemented platform service.
