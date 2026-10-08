# ZapX product brief

**Status:** Phase 1 approved baseline  
**Product type:** Local-first web product and developer API  
**Working language:** English product interface and documentation  
**Deployment boundary:** Reproducible local environment; public deployment is not required

## One-sentence product definition

ZapX gives developers and product operators one place to submit, observe, retry, and audit transactional notifications without coupling their applications directly to individual delivery providers.

## Problem statement

Small product teams often call email, SMS, or webhook providers directly from application code. Delivery logic, provider-specific errors, retries, and credentials become scattered across services, while operators lack a reliable view of what was queued, delivered, retried, or permanently failed.

ZapX centralizes that responsibility. Applications submit one typed notification request, delivery workers execute it through replaceable provider adapters, and operators can inspect every attempt and recover failed work through a web console.

This problem definition is a product hypothesis for a portfolio product. It is not presented as validated customer research.

## Target users

### Developer

Integrates an application with ZapX through an API key and needs stable contracts, idempotency, useful errors, and searchable delivery records.

### Product operator

Monitors transactional notifications, investigates failures, and retries recoverable deliveries without requiring database or server access.

### Workspace owner

Controls team access, provider credentials, API keys, templates, and audit history.

## Jobs to be done

- When an application must send a transactional notification, a developer wants one provider-independent API so delivery code does not spread throughout the application.
- When a provider is slow or unavailable, an operator wants controlled retries and a visible terminal failure state so messages are not silently lost.
- When a delivery is disputed or investigated, a team wants an immutable attempt timeline so it can explain what happened.
- When credentials or integrations change, an owner wants explicit access control and audit history so sensitive operations remain accountable.

## Product principles

- **Visible delivery:** every accepted request has a traceable status and attempt history.
- **Safe repetition:** client retries and worker retries do not create accidental duplicate deliveries.
- **Recoverable failure:** temporary errors retry automatically; terminal failures can be inspected and replayed deliberately.
- **Provider independence:** provider-specific behavior stays behind a common delivery contract.
- **Local completeness:** the core product works without a paid account or public deployment.
- **Honest evidence:** documentation and screenshots describe only implemented and validated behavior.

## Goals

1. A developer can create an API key, submit a valid notification, and retrieve its status through documented APIs.
2. An operator can complete the full delivery flow through the web product, from composing a message to inspecting its terminal result.
3. Temporary provider failures follow a bounded retry policy and permanent failures become visible, inspectable dead letters.
4. Duplicate client submissions with the same idempotency key resolve to one logical notification.
5. A reviewer can start the complete local product from a fresh clone and validate success, retry, and failure flows with synthetic data.

## Non-goals for the first release

- **Marketing campaigns:** audience segmentation, bulk campaigns, and engagement analytics are a separate product problem.
- **Public cloud deployment:** local reproducibility is the release target; hosting can be evaluated later.
- **SMS and commercial email accounts:** Resend and Twilio adapters are follow-up integrations after local SMTP and webhook delivery are complete.
- **Organization invitations and billing:** the first release uses one seeded workspace with role-based accounts.
- **Mobile application:** ZapX is an operations web console and API.
- **Visual drag-and-drop email design:** templates use structured fields and variables rather than a full design editor.
- **Guaranteed exactly-once external delivery:** ZapX provides idempotent intake and controlled processing, while external provider boundaries are documented as at-least-once where necessary.

## Success metrics

### Product validation

- 100% of P0 acceptance criteria pass automated or recorded end-to-end validation.
- A first-time reviewer can follow the README from fresh clone to a usable seeded product without undocumented manual database changes.
- The primary dashboard flow can create and inspect a successful local email or webhook delivery in under two minutes after login.
- Every terminal delivery shown in the UI includes notification identity, channel, provider, timestamps, and attempt history.

### Reliability validation

- A test batch of 1,000 accepted simulated notifications reaches one recorded terminal state per logical notification with no missing records.
- Reusing one idempotency key with an equivalent request returns the original logical notification; reusing it with a different payload is rejected.
- A configured transient failure retries according to policy and eventually succeeds or reaches the documented attempt limit.
- A configured permanent failure reaches dead-letter state and can be replayed only through an authorized action.

### Quality validation

- Required lint, typecheck, unit, integration, contract, browser, and build gates pass in CI.
- Production TypeScript files remain within 300 lines and tests within 1,000 lines.
- No credentials, raw secrets, or real recipient data exist in repository history, seed data, screenshots, or test fixtures.

## P0 release scope

### Access and workspace

- Seeded local workspace and synthetic accounts.
- Login, logout, session renewal, and role-based authorization.
- Owner, Operator, and Viewer roles; developers integrate through owner-issued API keys.
- Hashed API keys with creation, naming, revocation, and last-used metadata.

### Notification authoring

- Transactional notification composer in the web console.
- REST endpoint for machine submission.
- Email and webhook channels.
- Versioned templates with typed variables and preview data.
- Input validation and idempotency keys.

### Delivery and recovery

- Transactional persistence of notification and outbox event.
- Durable queue processing through a separate worker runtime.
- Local SMTP delivery to Mailpit.
- Signed HTTP webhook delivery to a local receiver.
- Bounded retry with exponential backoff and jitter.
- Provider and channel rate limits.
- Delivery attempt history.
- Dead-letter state and authorized manual replay.

### Product visibility

- Overview dashboard.
- Notification list with filters.
- Notification detail and attempt timeline.
- Template management.
- Provider connection management and connection test.
- API key management.
- Audit log.
- Live status updates while the console is open.
- Clear loading, empty, success, retry, offline, and failure states.

### Operations

- Structured logs with correlation identifiers.
- Health and readiness endpoints.
- Metrics for accepted work, queue delay, delivery duration, retries, failures, and dead letters.
- Trace continuity from intake through worker attempt.
- One documented local environment using Docker Compose.

## P1 follow-ups

- Scheduled notification delivery.
- Resend email adapter.
- Twilio SMS adapter.
- Workspace member invitation.
- Template version comparison and rollback.
- Configurable retry policy within safe limits.
- Outbound status callback to the submitting application.

## P2 future considerations

- Multi-workspace self-service onboarding.
- Push notification adapter.
- Regional data placement.
- Campaign and audience products as a separate bounded context.
- Provider routing based on cost, region, or health.
- Usage quotas and billing.

## Constraints

- The product must work without external paid services.
- All demo recipients and message content must be synthetic.
- The first release is transactional and low-volume by product scope, while load behavior is tested through simulated providers.
- Provider credentials must be encrypted at rest and masked after entry.
- The implementation follows the shared SRP, file-size, test, security, documentation, and portfolio evidence standards.

## Dependencies

- Docker-compatible local runtime.
- PostgreSQL for durable product state.
- Redis-backed queue infrastructure.
- Local SMTP inbox and local webhook receiver.
- A modern desktop browser for the operations console.

## Resolved product decisions

- English is used for the product interface and repository documentation.
- The primary product is a web console plus REST API.
- Email and webhook are the first channels.
- One seeded workspace provides the initial multi-role experience.
- Local execution is the release environment.
- External commercial providers are adapters added after the local core is complete.

## Phase 2 resolutions

- Encrypted recipient and rendered payload are retained for seven days after terminal state; notification metadata remains for 90 days and audit events for 180 days.
- The console uses the desktop operations route map defined in the technical specification, with responsive narrow-screen behavior required by P0.
- Automatic retry uses three attempts with 5-second, 30-second, and 2-minute defaults plus bounded jitter.
- Local secret protection uses an environment-supplied AES-256-GCM master-key adapter with key versioning and a replaceable hosted KMS boundary.
