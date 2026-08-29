# Unified Data Platform — Asset Model Service Context

## Project

This is an M.Tech Software Engineering dissertation project:

"Unified IIoT Data Platform for Operations Benchmarking and Optimization in Smart Manufacturing"

The repository root is:

unified-data-platform/

The current implementation focus is the:

Asset Model Service

located at:

services/asset-model-service/

The overall platform will eventually contain:

- Asset Model Service
- Messaging/Broker layer
- Time-Series Data Service
- Asset Simulator
- Angular UI
- Kubernetes deployment

Only the Asset Model Service is currently being implemented.

---

# Architecture Context

The platform is designed as a collection of microservices deployed on Kubernetes.

The Asset Model Service is responsible for:

- defining Asset Types
- defining variable schemas
- creating and managing Assets
- representing Asset hierarchy
- determining which variables an Asset exposes
- exposing REST APIs
- eventually publishing domain/lifecycle events through NATS

The Asset Model Service does NOT store historical telemetry.

Telemetry will belong to the future Time-Series Service using TimescaleDB.

---

# Technology Decisions

## Asset Model Service

- Node.js
- TypeScript
- NestJS 11
- Express
- TypeORM
- PostgreSQL
- REST APIs
- Jest
- Supertest
- @nestjs/config

## Messaging

NATS is the planned messaging infrastructure.

NATS is NOT being implemented yet.

Kafka and EMQX were considered but are not part of the current architecture.

Do not introduce Kafka or EMQX.

## Frontend

Angular is planned for the UI but is currently out of scope.

## Deployment

The services will eventually run in Docker/Kubernetes.

The Asset Model Service should therefore remain stateless.

---

# Repository Structure

The repository root is:

unified-data-platform/

The service is:

services/asset-model-service/

Feature-oriented structure:

src/
├── assets/
│   ├── controllers/
│   ├── dto/
│   ├── entities/
│   ├── repositories/
│   └── services/
│
├── asset-types/
│   ├── controllers/
│   ├── dto/
│   ├── entities/
│   ├── repositories/
│   └── services/
│
├── variables/
│   ├── controllers/
│   ├── dto/
│   ├── entities/
│   ├── repositories/
│   └── services/
│
├── database/
│   └── migrations/
│
├── events/
├── app.module.ts
└── main.ts

Do not reorganize this structure without an architectural reason.

---

# Domain Model

The Asset Model is type-driven.

An AssetType acts as a reusable template/contract.

Example:

MOTOR

Variables:

- temperature — REQUIRED — FLOAT — °C
- speed — REQUIRED — FLOAT — RPM
- vibration — OPTIONAL — FLOAT — mm/s

An actual Asset is an instance of an AssetType.

Example:

Motor-001
  AssetType = MOTOR

Motor-001 may expose:

- temperature
- speed
- vibration

Another asset of the same type may expose:

- temperature
- speed

---

# Domain Entities

There are five persistence entities.

## 1. AssetType

Represents the classification/template of an industrial asset.

Fields:

- id UUID primary key
- name string, required, unique
- description nullable
- createdAt
- updatedAt

Example:

AssetType:
  name = MOTOR
  description = Industrial electric motor

---

## 2. VariableDefinition

Represents the definition/schema of a variable.

The name is intentionally VariableDefinition rather than simply Variable.

Example:

temperature

- dataType = FLOAT
- unit = °C
- description = Motor temperature

VariableDefinition describes what a variable means.

It does NOT store:

- timestamp
- current value
- historical values

Those belong to the future Time-Series Service.

Fields:

- id UUID primary key
- name string, required
- dataType
- unit nullable
- description nullable
- createdAt
- updatedAt

---

## 3. AssetTypeVariable

This is an association entity.

It connects:

AssetType
    ↓
AssetTypeVariable
    ↓
VariableDefinition

The relationship itself contains:

required = true/false

Example:

MOTOR
├── temperature → required=true
├── speed → required=true
└── vibration → required=false

Fields:

- assetType relationship
- variableDefinition relationship
- required boolean

Composite uniqueness:

(asset_type_id, variable_definition_id)

must be unique.

---

## 4. Asset

Represents an actual physical or logical industrial asset.

Fields:

- id UUID primary key
- name string, required
- assetType relationship, required
- parentAsset relationship, nullable
- description nullable
- location nullable
- metadata JSONB nullable
- createdAt
- updatedAt

An Asset must belong to exactly one AssetType.

Example:

Motor-001
  assetType = MOTOR

---

## 5. AssetVariable

Association entity connecting:

Asset
    ↓
AssetVariable
    ↓
VariableDefinition

It answers:

"Which variables does this specific Asset expose?"

Fields:

- asset relationship
- variableDefinition relationship
- isCustom boolean

Composite uniqueness:

(asset_id, variable_definition_id)

must be unique.

Example:

Motor-001
├── temperature → isCustom=false
├── speed → isCustom=false
└── vibration → isCustom=false

Potentially:

Motor-001
└── current → isCustom=true

The service layer will later determine whether a custom variable is valid.

---

# Asset Hierarchy

Assets support a simple tree.

Example:

Plant-01
└── Line-01
    ├── Motor-001
    └── Pump-001

This is represented using:

parent_asset_id

An Asset:

- has zero or one parent
- can have many children
- root Assets have parent_asset_id = NULL

Use a self-referencing TypeORM relationship.

The model must not support:

- multiple parents
- arbitrary graphs
- separate Plant/Line/Machine tables

Circular hierarchy detection will be implemented in the domain/service layer.

---

# JSONB Metadata

Asset has:

metadata JSONB

This is ONLY for flexible descriptive metadata.

Example:

{
  "manufacturer": "ABC",
  "model": "X200",
  "serialNumber": "SN-001"
}

Do NOT use JSONB for:

- VariableDefinitions
- telemetry values
- telemetry history

---

# Database Model

Tables:

1. asset_types
2. variable_definitions
3. asset_type_variables
4. assets
5. asset_variables

Relationships:

AssetType 1 ─── N Asset

AssetType 1 ─── N AssetTypeVariable N ─── 1 VariableDefinition

Asset 1 ─── N AssetVariable N ─── 1 VariableDefinition

Asset 0..1 ─── N Asset
(parent/children)

---

# Database Constraints

All entity IDs use UUID.

asset_types:

- name UNIQUE
- name NOT NULL

asset_type_variables:

- asset_type_id FK
- variable_definition_id FK
- required NOT NULL DEFAULT false
- UNIQUE(asset_type_id, variable_definition_id)

assets:

- asset_type_id FK NOT NULL
- parent_asset_id FK nullable

asset_variables:

- asset_id FK
- variable_definition_id FK
- is_custom NOT NULL DEFAULT false
- UNIQUE(asset_id, variable_definition_id)

Useful indexes:

- assets.asset_type_id
- assets.parent_asset_id
- asset_type_variables.asset_type_id
- asset_variables.asset_id

Avoid dangerous cascading deletes.

Deleting an AssetType must not automatically delete its Assets.

Deleting a VariableDefinition should be restricted when it is referenced.

---

# TypeORM Architecture

Use:

TypeOrmModule.forRoot()

for the application-level database connection.

Use:

TypeOrmModule.forFeature([...])

inside feature modules.

Feature modules:

AssetTypeModule:
- AssetType
- AssetTypeVariable

AssetModule:
- Asset
- AssetVariable

VariableModule:
- VariableDefinition

Prefer:

autoLoadEntities: true

at the TypeORM root configuration.

Use:

synchronize: false

Database schema must be managed using migrations.

Desired lifecycle:

Entity
  ↓
Migration
  ↓
PostgreSQL schema

Do not use synchronize:true.

---

# Configuration

Use @nestjs/config.

Environment variables:

PORT=3000

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=unified_data_platform
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

.env is local-only and must be gitignored.

.env.example contains variable names without secrets.

Eventually Kubernetes Secrets/ConfigMaps will provide these values.

---

# Time-Series Boundary

The Asset Model Service does NOT store telemetry.

Future Time-Series Service:

TelemetryMeasurement

Fields conceptually:

- time
- asset_id
- variable_id
- value
- quality

Example:

asset_id = motor-001
variable_id = temperature-definition-id
time = ...
value = 72.4
quality = GOOD

The VariableDefinition provides the semantic identity of the telemetry variable.

Do not implement TelemetryMeasurement in the Asset Model Service.

---

# Current Implementation State

The NestJS project already exists.

Express is being used.

AssetType entity has already been implemented and builds successfully.

The following domain entities are being implemented incrementally:

- AssetType
- VariableDefinition
- AssetTypeVariable
- Asset
- AssetVariable

Do not overwrite working implementations unnecessarily.

Inspect existing files before changing them.

---

# Architectural Boundaries

Asset Model Service:

Owns:
- asset metadata
- asset types
- variable definitions
- asset hierarchy
- asset-variable associations

Time-Series Service:

Owns:
- telemetry measurements
- time-series queries
- aggregation over telemetry

Messaging:

NATS will eventually transport domain/lifecycle events.

Do not mix these responsibilities.