# GitHub Copilot Instructions

You are assisting with the implementation of the Asset Model Service in an M.Tech Software Engineering dissertation project.

Follow these instructions strictly.

## 1. Preserve the Architecture

Do not change architectural decisions silently.

The approved stack is:

- NestJS 11
- TypeScript
- Express
- TypeORM
- PostgreSQL
- Jest
- Supertest
- @nestjs/config
- NATS later

Do not introduce:

- Fastify
- Kafka
- EMQX
- MongoDB
- Redis
- Prisma

unless explicitly requested.

---

## 2. Work Incrementally

Implement one logical change at a time.

Before making a significant change:

1. Explain what will change.
2. Explain why it is required.
3. Identify affected files.
4. Implement only that change.

Do not generate the complete application in one operation.

---

## 3. Do Not Overwrite Working Code

Inspect existing files before modifying them.

Preserve existing implementation where it conforms to the architecture.

Do not regenerate entire files when a small modification is sufficient.

Avoid unrelated refactoring.

---

## 4. Teach While Coding

For important architectural or framework concepts, explain:

- what the concept is
- why it is needed
- how it maps to the architecture
- how it maps to the database
- why the chosen implementation is preferable

Important concepts include:

- TypeORM Entity
- Primary key
- Foreign key
- ManyToOne
- OneToMany
- JoinColumn
- association entities
- composite unique constraints
- migrations
- dependency injection
- NestJS modules
- repositories
- DTOs
- domain services

Do not assume that generated code is self-explanatory.

---

## 5. Domain Model Rules

Do not violate the approved model.

The five entities are:

- AssetType
- VariableDefinition
- AssetTypeVariable
- Asset
- AssetVariable

Do not merge these entities into generic JSON objects.

Do not introduce a generic "properties" model instead of VariableDefinition.

Do not store telemetry values in Asset or VariableDefinition.

---

## 6. AssetTypeVariable

AssetTypeVariable must remain an explicit association entity because it contains:

required

Do not replace it with a plain many-to-many relation.

Enforce:

UNIQUE(asset_type_id, variable_definition_id)

---

## 7. AssetVariable

AssetVariable must remain an explicit association entity because it contains:

isCustom

Enforce:

UNIQUE(asset_id, variable_definition_id)

---

## 8. Asset Hierarchy

Use:

parent_asset_id

for parent-child relationships.

Use TypeORM self-referencing relationships.

Do not introduce separate Plant, Line, Machine or Motor tables.

Do not implement arbitrary graph relationships.

Cycle detection belongs in the domain/service layer.

---

## 9. JSONB

Asset.metadata may use PostgreSQL JSONB.

Use JSONB only for flexible descriptive metadata.

Do not use JSONB to store:

- telemetry variables
- variable definitions
- telemetry measurements

---

## 10. Database Safety

Never enable:

synchronize: true

Use:

synchronize: false

Use explicit TypeORM migrations.

Do not introduce destructive cascade deletes.

Do not generate a migration that silently drops existing production data.

When generating migrations, explain the resulting schema first.

---

## 11. NestJS Modules

Use feature modules.

Desired ownership:

AssetTypeModule:
- AssetType
- AssetTypeVariable

AssetModule:
- Asset
- AssetVariable

VariableModule:
- VariableDefinition

AppModule owns the database connection.

Feature modules use:

TypeOrmModule.forFeature()

---

## 12. Separation of Concerns

Use the following architecture:

Controller
    ↓
Application/Domain Service
    ↓
Repository
    ↓
TypeORM
    ↓
PostgreSQL

Controllers should not directly contain database logic.

Repositories should not contain business rules.

Services should contain domain/business validation.

DTOs should represent API contracts.

Do not expose TypeORM entities directly as public API contracts once REST APIs are implemented.

---

## 13. Validation

Eventually implement validation for:

- required AssetType variables
- duplicate variable associations
- invalid AssetType references
- invalid VariableDefinition references
- self-parenting Assets
- circular Asset hierarchies
- invalid custom variables

Do not put all business validation into controllers.

---

## 14. Testing

Use Jest.

Prefer:

- unit tests for domain/service logic
- integration tests for repositories/database
- e2e tests for REST APIs

Do not write superficial tests merely to increase coverage.

Tests should validate actual architectural/business rules.

---

## 15. Migrations

Migration order should respect dependencies:

1. asset_types
2. variable_definitions
3. asset_type_variables
4. assets
5. asset_variables

Migrations must be reversible where practical.

Use explicit foreign keys.

Use explicit indexes.

Use explicit unique constraints.

---

## 16. NATS

NATS is planned but not currently being implemented.

Do not add NATS dependencies or event handlers unless explicitly requested.

When NATS is eventually added, it will be used for service-to-service/domain events rather than replacing PostgreSQL.

---

## 17. Time-Series

Do not add TimescaleDB to this service.

The future Time-Series Service will own telemetry.

Conceptually:

Asset Model:

VariableDefinition
    ↓
defines variable

Time-Series:

TelemetryMeasurement
    ↓
stores value at time T

Do not mix these responsibilities.

---

## 18. Kubernetes Awareness

The service will eventually run in Kubernetes.

Therefore:

- keep configuration externalized
- do not hard-code infrastructure addresses
- keep service stateless
- use environment variables
- avoid local filesystem state
- design for multiple replicas
- avoid in-memory shared state

Do not create Kubernetes manifests unless explicitly requested.

---

## 19. API Design

REST APIs will eventually be added.

Do not create controllers prematurely.

When APIs are implemented:

- use DTOs
- validate incoming requests
- return appropriate HTTP status codes
- avoid leaking persistence implementation details
- use Swagger/OpenAPI
- maintain consistent resource naming

Potential resources:

/asset-types
/variables
/assets

But do not implement these until the persistence/domain layer is complete.

---

## 20. Coding Style

Use:

- TypeScript strict typing
- meaningful names
- small methods
- dependency injection
- explicit types where useful
- clear error handling

Avoid:

- unnecessary abstractions
- premature generic repositories
- service locator patterns
- global mutable state
- magic strings
- unnecessary libraries

---

## 21. When Unsure

If the requested implementation conflicts with the architecture:

STOP.

Explain:

1. the conflict
2. why it matters
3. possible alternatives
4. your recommendation

Do not silently choose a different architecture.

---

## 22. Current Development Sequence

Follow this sequence unless explicitly changed:

1. Entities
2. TypeORM configuration
3. Feature modules
4. PostgreSQL connection
5. Migrations
6. Repositories
7. Domain/application services
8. Domain validation
9. DTOs
10. Controllers
11. Unit tests
12. Integration tests
13. REST API tests
14. NATS events
15. Docker
16. Kubernetes

Do not jump ahead without a reason.

---

## 23. Most Important Rule

The goal is not merely to produce working code.

The goal is to produce a system that:

- is architecturally defensible
- is understandable by the developer
- is implementable by a software engineering team
- can be explained in an M.Tech dissertation
- can be evaluated experimentally
- can scale to simulated industrial assets
- can eventually run as Kubernetes microservices

Every implementation decision should support those goals.