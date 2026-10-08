# ZapX technical specification

**Status:** implemented local release
**Scope source:** [Product brief](../product/product-brief.md)  
**Release boundary:** Complete local product; public deployment is outside P0

## Technical objective

Build a local-first notification delivery product whose API accepts one transactional message, persists it atomically, dispatches it asynchronously, records every delivery attempt, and exposes success or recovery through an operations console.

The design favors explicit reliability and explainability over premature distribution. API, worker, and web run as separate processes while sharing one domain and contract workspace.

## Technology baseline

| Area                       | Selection                            | Purpose                                                                              |
| -------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| Language                   | TypeScript in strict mode            | Shared types and consistent full-stack tooling                                       |
| API and worker framework   | NestJS                               | Modules, dependency injection, validation, OpenAPI, and BullMQ integration           |
| Web application            | React with Vite                      | Authenticated operations console without server rendering requirements               |
| Database                   | PostgreSQL                           | Durable transactions, constraints, indexing, locking, and audit state                |
| Persistence                | Explicit `pg` repositories           | Visible SQL, transaction boundaries, locks, and reproducible migrations              |
| Queue                      | BullMQ backed by Redis               | Delayed retry, worker concurrency, rate limiting, and durable queue state            |
| Local email                | SMTP with Mailpit                    | Account-free end-to-end email delivery and inspection                                |
| Local webhook              | Purpose-built receiver               | Signature, retry, timeout, and response simulation                                   |
| Contracts                  | Zod and runtime OpenAPI              | Runtime validation and an inspectable local HTTP contract                            |
| Live status                | Server-Sent Events                   | One-way delivery updates with a smaller protocol surface than bidirectional sockets  |
| Logs                       | Pino                                 | Structured JSON logs with redaction                                                  |
| Telemetry                  | Trace identities and structured logs | Correlation across API, relay, queue, worker, and provider without an external stack |
| Metrics                    | Prometheus text endpoint             | Local counts and timing evidence through a standard scrape format                    |
| Unit and integration tests | Vitest and real local services       | Domain, API, PostgreSQL, Redis, SMTP, and provider behavior                          |
| Browser tests              | Playwright                           | End-user validation in a real browser                                                |
| Package management         | pnpm workspace                       | One lockfile and explicit internal packages                                          |
| Runtime assembly           | Docker Compose                       | Reproducible multi-service local environment                                         |

Exact dependency versions are selected and locked during Phase 3.

## Runtime components

### Web

- Authenticated React operations console.
- Uses session cookies for browser requests.
- Consumes REST resources and a workspace-scoped SSE stream.
- Contains no provider credentials or queue access.

### API

- Terminates browser sessions and machine API-key authentication.
- Validates commands and applies authorization.
- Writes product state and outbox events in PostgreSQL transactions.
- Serves query endpoints, OpenAPI, health, readiness, and SSE.
- Does not call delivery providers from request handlers.

### Worker

- Runs the outbox relay and delivery processors as separate worker roles.
- Claims outbox rows in ordered batches.
- Publishes queue jobs with deterministic job identities.
- Executes rate-limited provider adapters.
- Records attempts and state transitions transactionally.
- Emits traces, metrics, and sanitized logs.

### PostgreSQL

- Source of truth for identity, configuration, notification, delivery, attempts, idempotency, outbox, and audit.
- Keeps product state independent from Redis retention.

### Redis and BullMQ

- Coordinates waiting, active, delayed, and retrying jobs.
- Does not become the authoritative source for business status.

### Mailpit and webhook receiver

- Provide locally observable delivery destinations.
- Webhook receiver validates ZapX signatures and can simulate status codes, delay, timeout, and connection failure.

### Observability surface

- Pino emits structured logs with sensitive-field redaction.
- One trace identity follows notification intake, outbox publication, queue work, and attempts.
- `/metrics` exposes notification states, attempt outcomes, queue wait, and provider duration in Prometheus text format.
- The console consumes workspace status through an authenticated SSE stream.
- An external collector, dashboard, and tracing backend remain outside the local release.

## Workspace layout

```text
zapx/
├── apps/
│   ├── api/
│   ├── web/
│   ├── worker/
│   └── webhook-receiver/
├── packages/
│   ├── config/
│   ├── contracts/
│   ├── domain/
│   ├── observability/
│   ├── database/
│   ├── domain/
│   ├── observability/
│   └── security/
├── docs/
├── tests/browser/
└── scripts/
```

Internal packages expose deliberate public entry points. Applications cannot import another application's internal source.

## Bounded modules

| Module        | Responsibility                                                          |
| ------------- | ----------------------------------------------------------------------- |
| Identity      | Users, sessions, password reset, and role membership                    |
| Workspaces    | Workspace settings and membership boundaries                            |
| API keys      | Machine credentials, scopes, revocation, and usage metadata             |
| Providers     | Provider configuration, encrypted secrets, and connection testing       |
| Templates     | Versioned content, variable schema, preview, and publication            |
| Notifications | Intake, validation, idempotency, rendered snapshot, and current status  |
| Deliveries    | Queue dispatch, attempts, retry classification, dead letter, and replay |
| Outbox        | Atomic event persistence and queue publication                          |
| Audit         | Append-only record of sensitive actions                                 |
| Operations    | Health, readiness, metrics, traces, and retention jobs                  |

## Core invariants

- Every domain record belongs to exactly one workspace unless it is an internal system record.
- A notification references one immutable template version and one provider connection snapshot.
- One workspace, operation, and idempotency key identify at most one logical request.
- Notification creation and outbox creation commit together or not at all.
- A provider call occurs only after a durable notification exists.
- Attempt numbers increase monotonically within one notification.
- Delivered notifications never return to an active state.
- Dead-letter replay is an explicit authorized transition that appends history.
- Provider responses, errors, and logs are sanitized before persistence.
- Queue state may be rebuilt from durable records; Redis is not used for audit history.

## Web screen map

| Route                | Primary capability                           | Roles                   |
| -------------------- | -------------------------------------------- | ----------------------- |
| `/login`             | Create browser session                       | Anonymous               |
| `/`                  | Operational overview and recent failures     | Owner, Operator, Viewer |
| `/notifications`     | Filter and inspect notifications             | Owner, Operator, Viewer |
| `/notifications/new` | Compose and submit notification              | Owner, Operator         |
| `/notifications/:id` | Inspect status, attempts, and trace identity | Owner, Operator, Viewer |
| `/templates`         | List templates and versions                  | Owner, Operator, Viewer |
| `/templates/:id`     | Edit draft, preview, and publish             | Owner, Operator         |
| `/providers`         | List connections and health                  | Owner, Operator, Viewer |
| `/providers/:id`     | Configure and test provider                  | Owner                   |
| `/api-keys`          | Create, inspect metadata, and revoke         | Owner                   |
| `/dead-letters`      | Inspect terminal failures                    | Owner, Operator, Viewer |
| `/audit`             | Review sensitive actions                     | Owner, Viewer           |

## Role permissions

| Capability          | Owner | Operator | Viewer | API key               |
| ------------------- | ----- | -------- | ------ | --------------------- |
| Read product state  | Yes   | Yes      | Yes    | Scoped                |
| Submit notification | Yes   | Yes      | No     | `notifications:write` |
| Replay dead letter  | Yes   | Yes      | No     | Not in P0             |
| Manage templates    | Yes   | Yes      | No     | Not in P0             |
| Configure providers | Yes   | No       | No     | No                    |
| Manage API keys     | Yes   | No       | No     | No                    |
| View audit records  | Yes   | No       | Yes    | No                    |

## Performance budgets

Budgets apply to the documented local validation environment after warm-up.

- Notification intake response: p95 below 300 ms excluding dependency outage.
- Read query response for indexed P0 list/detail endpoints: p95 below 250 ms for the validation dataset.
- SSE status propagation after committed state change: p95 below two seconds.
- Outbox publication delay under normal local operation: p95 below one second.
- Dashboard initial usable content: below three seconds in the Playwright validation environment.

These are engineering validation budgets rather than production service-level promises.

## Data retention baseline

- Encrypted recipient and rendered payload: seven days after terminal state.
- Provider response body: sanitized and truncated immediately; retained seven days.
- Notification, delivery, attempt metadata, and metrics: 90 days.
- Authentication and audit events: 180 days.
- Expired sessions and idempotency response bodies: seven days after expiry.

Retention periods are configurable for local validation. Cleanup is idempotent, audited at summary level, and never deletes required audit actor labels.

## Release verification

- Product P0 and non-goals remain unchanged.
- State transitions, API semantics, data ownership, and failure behavior are implemented and tested.
- Security trust boundaries and secret storage are active.
- No implementation choice requires an external paid service.
- The end-user browser flow and local delivery evidence are recorded in [Phase 7](phase-7-validation.md).
