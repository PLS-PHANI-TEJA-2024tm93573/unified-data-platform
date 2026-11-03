# Architecture Decision Record: Asset Metadata Synchronization Between Asset Model Service and Data Service

**Status:** Proposed / Agreed implementation direction\
**Decision:** Debounced metadata-change notification using NATS\
**NATS subject:** `asset.metadata.update`\
**Date:** 3 November 2026\
**Context:** IIoT smart-manufacturing platform

------------------------------------------------------------------------

## 1. Context and Problem Statement

The platform separates asset modelling from telemetry ingestion and KPI
calculation:

-   **Asset Model Service** owns the asset hierarchy, asset types,
    variable definitions, and variable-to-asset assignments.
-   **Data Service** receives/stores telemetry and maintains a local
    metadata cache used to validate and resolve asset-variable
    identifiers.
-   **KPI Service** reads measurement history from Data Service to
    calculate KPIs such as OEE.
-   A provisioning Bash script calls the Asset Model APIs to create or
    reuse asset types, variables, assets, and their associations.

The Asset Model Service is the source of truth for asset metadata. Data
Service maintains a local, read-optimized copy of the relevant metadata.

### 1.1 Issue encountered

When the live OEE dashboard connects, KPI Service requests measurement
history from Data Service. Data Service can return `404` when the
requested asset-variable ID is not present in its metadata cache.

The underlying issue is that Data Service builds or loads its metadata
cache before the asset hierarchy and variable assignments have been
created, or its cache becomes stale after metadata changes. For example:

1.  Data Service starts and loads metadata.
2.  The Asset Model hierarchy is created later using the provisioning
    script.
3.  The script successfully creates assets, variable definitions, and
    assignments in Asset Model Service.
4.  Data Service is not automatically aware that the metadata has
    changed.
5.  KPI Service requests data using an asset-variable ID that Data
    Service does not recognize in its local metadata cache.
6.  The request can fail with `404`, even though the asset-variable
    relationship exists in Asset Model Service.

This is a metadata synchronization problem, not necessarily a
telemetry-ingestion or KPI-calculation problem.

### 1.2 Why the provisioning script makes this more visible

The Bash script performs multiple sequential API operations. It is
idempotent: it checks whether objects or associations already exist and
creates only missing ones.

A single script execution can therefore produce many successful metadata
mutations, including:

-   Creating asset types.
-   Creating variable definitions.
-   Associating variable definitions with asset types.
-   Creating assets.
-   Assigning variables to assets.

Not every HTTP request is a mutation. GET requests do not change
metadata, and a get-or-create operation that finds an existing object
does not create a new mutation. Only successful write operations that
actually change persisted metadata should mark the metadata as changed.

Publishing one synchronization notification for every individual
mutation could cause Data Service to repeatedly fetch and rebuild the
entire hierarchy while the script is still running.

------------------------------------------------------------------------

## 2. Design Goals

The synchronization design should:

1.  Preserve Asset Model Service as the authoritative source of asset
    metadata.
2.  Keep Data Service's metadata cache synchronized without making KPI
    Service responsible for synchronization.
3.  Work for both a single metadata change from a UI/API client and
    multiple changes from a provisioning script.
4.  Avoid changing the existing Asset Model API contracts.
5.  Avoid publishing one NATS event for every write when multiple writes
    occur close together.
6.  Recover from missed notifications or service restarts.
7.  Avoid exposing partially rebuilt metadata to Data Service consumers.
8.  Make only the minimum code changes needed in the two services.

------------------------------------------------------------------------

## 3. Solutions Considered

### 3.1 Publish an event after every successful mutation

**Description**

Asset Model Service publishes a NATS event immediately after each
successful metadata-changing database transaction.

**Advantages**

-   Simple event semantics.
-   Changes are announced quickly.
-   No need to infer whether a sequence of API calls is a bulk
    operation.

**Drawbacks**

-   A provisioning script can cause many events.
-   Data Service may fetch the full hierarchy repeatedly while the
    script is still creating it.
-   Intermediate synchronizations may contain an incomplete hierarchy.
-   This can create unnecessary API traffic, cache rebuilds, and
    processing.

This is valid for low-volume changes but is inefficient for a script
that creates many related records.

### 3.2 Fixed-interval notifications

**Description**

Asset Model Service periodically publishes a synchronization
notification, regardless of whether metadata changed, or checks for
changes at a fixed interval and publishes when it detects one.

**Advantages**

-   Naturally groups multiple changes that happen between checks.
-   Does not require the Bash script to know about NATS.
-   Simple periodic reconciliation can help recover from missed
    notifications.

**Drawbacks**

-   Synchronization is delayed until the next interval.
-   Publishing unconditionally creates unnecessary notifications and
    fetches.
-   A fixed interval does not identify the exact end of a bulk
    operation.
-   It can still synchronize an incomplete hierarchy if a provisioning
    script is running across interval boundaries.

A version-aware periodic check is preferable to unconditional
publishing, but periodic checks alone do not provide immediate change
notification.

### 3.3 Explicit bulk-operation completion signal

**Description**

The provisioning process or Asset Model Service identifies a batch and
publishes one notification when all operations in that batch have
completed.

**Advantages**

-   Can provide a clear batch-completion boundary.
-   Can avoid intermediate full-hierarchy synchronizations.

**Drawbacks**

-   Existing APIs do not expose a batch lifecycle or completion signal.
-   The requirement is to leave the existing API contracts unchanged.
-   Reliable batch tracking would require additional internal state or a
    new internal operation.
-   The current Bash script should not become responsible for publishing
    directly to NATS; Asset Model Service should own its metadata-change
    notifications.

This can be revisited if exact batch completion becomes a requirement.

### 3.4 Debounce metadata changes (selected approach)

**Description**

After every successful metadata mutation, Asset Model Service marks
metadata as dirty and starts or resets a short debounce timer. If
another mutation occurs before the quiet period expires, the timer is
reset. When no further mutation occurs during the configured quiet
period, Asset Model Service publishes one NATS event on
`asset.metadata.update`.

Data Service receives the notification and fetches the latest complete
hierarchy from Asset Model Service.

**Advantages**

-   Handles a single variable update and a multi-operation provisioning
    script through the same mechanism.
-   Does not require changes to existing API contracts or the Bash
    script.
-   Combines closely spaced metadata changes into one notification.
-   Keeps event ownership in Asset Model Service.
-   Data Service always fetches the authoritative current hierarchy
    rather than relying on a possibly incomplete event payload.

**Drawbacks**

-   A debounce timer detects a period of inactivity; it does not know
    that a bulk operation has semantically finished.
-   If a script pauses longer than the debounce period between
    operations, multiple notifications and synchronizations can occur.
-   A short quiet period may cause unnecessary intermediate
    synchronizations; a long period increases synchronization latency
    for a single update.
-   An in-memory timer and dirty flag can be lost if Asset Model Service
    restarts before publishing.
-   NATS Core Pub/Sub notifications can be missed if Data Service is
    offline or disconnected when the event is published.
-   A debounce window does not guarantee exactly one synchronization per
    script execution.

**Decision:** Use debouncing as the primary change-notification
mechanism, with startup synchronization and periodic reconciliation as
recovery mechanisms.

------------------------------------------------------------------------

## 4. Agreed Architecture

### 4.1 Responsibilities

  -----------------------------------------------------------------------
  Component                           Responsibility
  ----------------------------------- -----------------------------------
  Asset Model Service                 Owns authoritative metadata and
                                      detects successful metadata
                                      mutations.

  Asset Model Service                 Marks metadata as dirty and
                                      debounces closely spaced changes.

  Asset Model Service                 Publishes a notification on NATS
                                      subject `asset.metadata.update`
                                      after the quiet period.

  NATS                                Delivers the metadata-update
                                      notification to subscribers.

  Data Service                        Subscribes to
                                      `asset.metadata.update`.

  Data Service                        Fetches the latest complete
                                      hierarchy using the existing Asset
                                      Model API.

  Data Service                        Builds and atomically replaces its
                                      local metadata cache.

  KPI Service                         Continues to consume Data Service
                                      APIs; it does not coordinate
                                      metadata synchronization.
  -----------------------------------------------------------------------

### 4.2 Architecture flow

``` mermaid
flowchart TD
    SCRIPT[Bash provisioning script / UI / API client]
    API[Asset Model metadata API]
    DB[(Asset Model database)]
    DETECTOR[Metadata change detector]
    TIMER[Debounce timer]
    NATS[NATS: asset.metadata.update]
    DS[Data Service subscriber]
    FETCH[GET /assets/hierarchy]
    CACHE[Build new metadata snapshot]
    SWAP[Atomically replace local cache]
    KPI[KPI Service]

    SCRIPT --> API
    API --> DB
    DB -->|Successful commit| DETECTOR
    DETECTOR --> TIMER
    TIMER -->|Quiet period elapsed| NATS
    NATS --> DS
    DS --> FETCH
    FETCH --> API
    API --> DB
    FETCH --> CACHE
    CACHE --> SWAP
    SWAP --> KPI
```

### 4.3 Debounce behavior

Use a configurable quiet period. An initial value of **3 seconds** is a
reasonable starting point for development and should be tuned using
observed script execution patterns and synchronization costs.

Illustrative sequence:

  Time       Operation                            Debounce behavior
  ---------- ------------------------------------ -------------------------
  10:00:00   Create variable A                    Mark dirty; start timer
  10:00:01   Create variable B                    Reset timer
  10:00:02   Create variable C                    Reset timer
  10:00:03   Assign variable A to asset           Reset timer
  10:00:04   Create asset                         Reset timer
  10:00:05   Assign variable B to asset           Reset timer
  10:00:08   No further mutations for 3 seconds   Publish one event

A single update follows the same path: mark dirty, wait for the quiet
period, then publish.

### 4.4 Which operations should mark metadata as changed?

Only successful operations that actually change persisted metadata
should invoke the change detector.

Examples include:

-   Create, update, or delete an asset type.
-   Create, update, or delete a variable definition.
-   Add or remove a variable definition from an asset type.
-   Create, update, or delete an asset.
-   Assign or remove a variable from an asset.

GET/read operations must not trigger the change detector. A
get-or-create request that discovers an existing record and performs no
write must not trigger it either. A failed request or rolled-back
transaction must not trigger it.

The notification should be emitted only after the database transaction
commits successfully.

------------------------------------------------------------------------

## 5. NATS Event Contract

**Subject:** `asset.metadata.update`

The event is a notification that the Asset Model metadata has changed
and Data Service should refresh its local copy. It should not contain
the full hierarchy.

Example payload:

``` json
{
  "eventId": "evt-unique-id",
  "eventType": "ASSET_METADATA_UPDATE",
  "source": "asset-model-service",
  "timestamp": "2026-11-03T16:30:00Z",
  "metadataVersion": 12
}
```

Recommended fields:

  -----------------------------------------------------------------------
  Field                               Purpose
  ----------------------------------- -----------------------------------
  `eventId`                           Unique identifier for diagnostics
                                      and duplicate handling.

  `eventType`                         Identifies the notification type.

  `source`                            Identifies Asset Model Service as
                                      the publisher.

  `timestamp`                         Time the notification was created.

  `metadataVersion`                   Monotonically increasing metadata
                                      revision, if implemented.
  -----------------------------------------------------------------------

The `metadataVersion` is useful but should not be fabricated from an
in-memory counter that can reset after a restart. Prefer a durable
revision stored in the Asset Model database or another reliable
persisted mechanism.

Data Service should treat the event as a refresh request, not as a
complete description of the change.

------------------------------------------------------------------------

## 6. Data Service Synchronization Behavior

When Data Service receives `asset.metadata.update`:

1.  Validate the event and read its metadata version, if present.
2.  If a synchronization is already running, coalesce the request rather
    than launching an unbounded number of concurrent synchronizations.
3.  Call the existing Asset Model API: `GET /assets/hierarchy`.
4.  Validate the response.
5.  Build a new metadata cache snapshot separately from the currently
    active cache.
6.  If the fetch and cache construction succeed, atomically replace the
    active cache.
7.  Record the last successful synchronization time and metadata
    version.
8.  If synchronization fails, retain the last known-good cache and
    log/measure the failure. Retry using a bounded retry/backoff policy
    or wait for a later notification/reconciliation.

The cache must not be cleared before the replacement snapshot has been
fetched and validated. Consumers should see either the previous complete
snapshot or the new complete snapshot, never a partially populated
intermediate state.

### 6.1 Startup synchronization

Data Service should perform a full metadata synchronization during
startup. It should not depend on receiving a NATS event before its cache
becomes usable.

### 6.2 Periodic reconciliation

NATS Core Pub/Sub does not provide replay of messages published while a
subscriber is offline. Therefore, Data Service should also perform
periodic reconciliation against Asset Model Service, or the architecture
should use a durable NATS JetStream consumer if stronger delivery and
replay guarantees are required.

Periodic reconciliation is a safety net; it is not a replacement for the
debounced notification.

### 6.3 Optional on-demand fallback

If Data Service receives a request for an unknown asset-variable ID, it
may perform one controlled metadata refresh and retry the lookup once.
This should be bounded and protected against repeated concurrent
refreshes. If the identifier is still unknown after a successful
refresh, return the appropriate not-found response.

This is an optional resilience measure and should not replace normal
synchronization.

------------------------------------------------------------------------

## 7. Drawbacks and Limitations of the Selected Design

The debounce design is deliberately pragmatic, but its guarantees must
be understood.

### 7.1 No exact bulk-completion detection

A quiet period is only an approximation of completion. If the
provisioning script pauses longer than the configured quiet period,
Asset Model Service will publish an event even though the script has
more work to do.

For example, with a 3-second quiet period:

-   The script performs several writes.
-   It pauses for 5 seconds.
-   Asset Model Service publishes a notification.
-   The script resumes and performs more writes.
-   Another notification is published after the next quiet period.

This may produce multiple synchronizations. The system remains correct
if each synchronization fetches the latest full hierarchy, but it may
perform redundant work.

### 7.2 Synchronization latency

A single metadata change is not announced immediately. It is announced
only after the quiet period expires, plus NATS delivery and
hierarchy-fetch time.

### 7.3 Restart durability

If the dirty flag and timer exist only in process memory, a restart can
discard a pending notification. For production robustness, persist the
dirty/revision state and use a background publisher or transactional
outbox.

### 7.4 Notification delivery

With NATS Core Pub/Sub, a subscriber that is offline at publication time
can miss the event. Startup synchronization and periodic reconciliation
mitigate this. JetStream durable consumers are an alternative if durable
event delivery is required.

### 7.5 Concurrent updates and synchronization races

Multiple updates can arrive while Data Service is fetching the
hierarchy. Data Service should serialize or coalesce synchronization
requests and compare metadata versions where available. It must not
allow an older, slower fetch to overwrite a newer cache snapshot.

### 7.6 Timer selection is a trade-off

A short debounce interval reduces latency but may produce more
synchronizations. A long interval groups more writes but delays
visibility of a single update. The interval should be configurable and
selected using actual workload observations rather than treated as a
universal constant.

------------------------------------------------------------------------

## 8. Reliability and Implementation Considerations

Recommended safeguards:

-   Trigger change detection only after successful database commits.
-   Keep the debounce timer and change detector centralized rather than
    duplicating timer logic in every controller.
-   Make the dirty state durable if notification loss across process
    restarts is unacceptable.
-   Consider a transactional outbox so the metadata mutation and pending
    notification record are committed atomically.
-   Make Data Service synchronization idempotent.
-   Coalesce concurrent refresh requests.
-   Keep the previous cache available until the new snapshot is ready.
-   Record last successful sync time, last successful metadata version,
    sync duration, and failures.
-   Add structured logs for event publication, event receipt, hierarchy
    fetch, and cache replacement.
-   Keep the NATS subject and payload contract explicit and versionable.

A transactional outbox is a production-hardening option, not a reason to
redesign the existing APIs. It stores an event record in the same
database transaction as the metadata mutation; a background publisher
then sends pending events to NATS and marks them as published.

------------------------------------------------------------------------

## 9. Decision Summary

**Selected decision:** Implement debounced metadata-change notifications
in Asset Model Service and synchronize Data Service's metadata cache
from the complete Asset Model hierarchy.

-   NATS subject: `asset.metadata.update`.
-   Asset Model Service detects successful metadata mutations.
-   Each mutation marks metadata as dirty and resets a configurable
    debounce timer.
-   When the quiet period expires, Asset Model Service publishes one
    notification.
-   Data Service subscribes and fetches `GET /assets/hierarchy`.
-   Data Service builds a new snapshot and atomically swaps its local
    cache.
-   Data Service performs startup synchronization and periodic
    reconciliation to recover from missed events.
-   Existing API contracts and the provisioning Bash script remain
    unchanged.

**Important qualification:** Debouncing groups nearby changes; it does
not guarantee exactly one notification per script execution or prove
that a bulk operation has completed. The design favors eventual
consistency and reduced redundant synchronization without requiring a
batch API.

------------------------------------------------------------------------

## 10. Dissertation Relevance

This decision demonstrates a practical integration pattern in an IIoT
architecture where asset modelling and telemetry services are
independently deployable.

It addresses the consistency boundary between:

-   The authoritative OT/IT asset metadata model.
-   The Data Service's local metadata representation required for
    telemetry ingestion and querying.
-   Downstream KPI consumers that depend on correct asset-variable
    identity resolution.

The design uses asynchronous messaging to reduce tight runtime coupling,
a debounced notification strategy to aggregate bursts of metadata
mutations, and full-snapshot synchronization to simplify consistency.
Startup synchronization and periodic reconciliation provide recovery
paths where transient messaging failures occur.

For dissertation evaluation, useful measurements include:

-   Time from the final metadata mutation to Data Service cache
    convergence.
-   Number of metadata writes versus number of NATS notifications.
-   Number and duration of hierarchy fetches during provisioning.
-   Cache synchronization success/failure rate.
-   Behavior when Data Service is offline during notification
    publication.
-   Behavior when Asset Model Service restarts while metadata is dirty.
-   Correctness of the cache under concurrent metadata changes.

These measurements can help evaluate the trade-off between
synchronization latency, messaging overhead, and eventual consistency.
