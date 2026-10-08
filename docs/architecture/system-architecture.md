# ZapX system architecture

## Context

```mermaid
flowchart LR
    Developer[Developer application] -->|API key + HTTPS| ZapX[ZapX]
    Operator[Owner / Operator / Viewer] -->|Browser session| ZapX
    ZapX -->|SMTP| Mailpit[Local Mailpit inbox]
    ZapX -->|Signed HTTP| Receiver[Local webhook receiver]
    ZapX -->|Optional later| External[Commercial providers]
```

## Containers and trust boundaries

```mermaid
flowchart TB
    Browser[React web console]
    Client[Machine client]

    subgraph Application[ZapX application boundary]
        API[NestJS API]
        Relay[Outbox relay]
        Worker[Delivery worker]
        Receiver[Webhook test receiver]
    end

    subgraph State[State boundary]
        DB[(PostgreSQL)]
        Redis[(Redis / BullMQ)]
    end

    subgraph Delivery[Provider boundary]
        SMTP[Mailpit SMTP]
        Webhook[HTTP webhook destination]
    end

    subgraph Telemetry[Observability boundary]
        Collector[OpenTelemetry Collector]
        Prometheus[Prometheus]
        Grafana[Grafana]
        Jaeger[Jaeger]
    end

    Browser --> API
    Client --> API
    API --> DB
    Relay --> DB
    Relay --> Redis
    Redis --> Worker
    Worker --> DB
    Worker --> SMTP
    Worker --> Webhook
    Receiver --> Webhook
    API --> Collector
    Relay --> Collector
    Worker --> Collector
    Collector --> Jaeger
    Prometheus --> API
    Prometheus --> Worker
    Grafana --> Prometheus
```

## Primary command flow

```mermaid
sequenceDiagram
    participant C as Browser or client
    participant A as API
    participant P as PostgreSQL
    participant R as Outbox relay
    participant Q as BullMQ
    participant W as Worker
    participant D as Provider

    C->>A: POST /v1/notifications
    A->>A: Authenticate, authorize, validate
    A->>P: Begin transaction
    A->>P: Insert notification + idempotency + outbox
    A->>P: Commit
    A-->>C: 202 Accepted
    R->>P: Claim pending outbox batch
    R->>Q: Add deterministic job
    R->>P: Mark outbox published
    Q->>W: Deliver job
    W->>P: Claim notification attempt
    W->>D: Send through adapter
    D-->>W: Provider result
    W->>P: Append attempt + transition status
    W-->>C: SSE status event through API
```

## Query flow

Read endpoints query PostgreSQL through workspace-scoped repositories. The API returns explicit pagination cursors and never derives authoritative status from BullMQ.

## Dependency rules

```text
delivery adapters ──→ provider-sdk interfaces
persistence adapters ──→ domain repository interfaces
API controllers ──→ application services ──→ domain
worker processors ──→ application services ──→ domain
domain ──→ no framework, database, Redis, or HTTP package
```

The domain package contains values, policies, state transitions, and ports. NestJS modules compose concrete adapters at application startup.

## Scaling model

- API instances are stateless apart from browser session and connection coordination stored in shared dependencies.
- Outbox relay instances coordinate with PostgreSQL row locks.
- Worker concurrency scales horizontally while BullMQ applies the configured provider limits.
- SSE initially uses one API instance in local mode. A future multi-instance deployment can fan out committed status events through Redis pub/sub without changing the public contract.

## Failure ownership

| Failure                    | Owner           | Durable evidence                       | User behavior                                     |
| -------------------------- | --------------- | -------------------------------------- | ------------------------------------------------- |
| Invalid request            | API             | Optional security log; no notification | Field-level problem response                      |
| PostgreSQL unavailable     | API or worker   | Runtime telemetry                      | Intake rejected; readiness false                  |
| Redis unavailable          | Relay or worker | Pending outbox remains in PostgreSQL   | Accepted work remains pending; readiness degraded |
| Provider transient failure | Worker          | Attempt row                            | Retry scheduled visibly                           |
| Provider permanent failure | Worker          | Attempt row                            | Dead letter visible                               |
| Ambiguous provider result  | Worker          | Indeterminate attempt                  | No blind automatic duplicate; operator review     |
| Browser SSE disconnected   | Browser and API | Connection metric                      | Visible disconnected state and refresh fallback   |

## Local service topology

Docker Compose starts web, API, worker, webhook receiver, PostgreSQL, Redis, Mailpit, OpenTelemetry Collector, Prometheus, Grafana, and Jaeger. Profiles may disable the observability UI for fast unit work, while the complete validation profile starts every service.
