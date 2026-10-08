# ZapX engineering decisions

## ADR-001: Modular monolith with split runtimes

**Decision:** Keep one repository and shared domain while running web, API, outbox relay, and delivery worker as separate processes.

**Reason:** This preserves clear boundaries and independent failure behavior without introducing network contracts and operational cost between premature microservices.

**Consequence:** Module dependency rules and public package entry points must be enforced. A bounded context can be extracted later if measured scaling or ownership requires it.

## ADR-002: TypeScript, NestJS, and React

**Decision:** Use strict TypeScript across product code, NestJS for API and worker composition, and React with Vite for the console.

**Reason:** ZapX needs explicit interfaces, provider polymorphism, runtime validation, async workers, and a typed web client. One language allows contract reuse while still exercising OOP and functional transformations where each fits.

**Consequence:** Runtime schemas remain mandatory because TypeScript types disappear at network and queue boundaries.

## ADR-003: PostgreSQL is the source of truth

**Decision:** Persist authoritative notification, attempt, idempotency, outbox, and audit state in PostgreSQL.

**Reason:** Product status needs transactions, constraints, queryable history, and retention independent from queue cleanup.

**Consequence:** Dashboard status is never calculated only from BullMQ. Redis loss may delay work but cannot erase accepted product records.

## ADR-004: Transactional outbox before queue publication

**Decision:** Commit notification and outbox event in one PostgreSQL transaction, then publish asynchronously.

**Reason:** Writing PostgreSQL and Redis directly in one request creates a dual-write gap where a crash can leave an accepted notification without work.

**Consequence:** An outbox relay, publication metrics, backlog threshold, and reconciliation process are required.

## ADR-005: BullMQ with at-least-once processing

**Decision:** Use BullMQ for waiting, delayed retry, concurrency, and provider limits while designing workers for duplicate execution.

**Reason:** Redis-backed BullMQ provides the queue behaviors ZapX needs and integrates with NestJS. Universal exactly-once external delivery cannot be guaranteed across provider boundaries.

**Consequence:** Job identities are deterministic, state transitions are guarded, attempt allocation is unique, and indeterminate outcomes remain visible.

## ADR-006: Provider ports and adapters

**Decision:** Domain and application services depend on a small provider interface; SMTP and signed webhook are initial adapters.

**Reason:** Providers differ in authentication, failure codes, rate limits, and idempotency. A normalized result contract keeps those details out of delivery policy.

**Consequence:** Every adapter must pass the same contract suite and explicitly classify success, transient, permanent, and indeterminate outcomes.

## ADR-007: Server-Sent Events for live console status

**Decision:** Use SSE for workspace-scoped delivery updates.

**Reason:** Status updates are primarily server-to-browser. SSE supports reconnection and browser streaming with a smaller protocol surface than bidirectional messaging.

**Consequence:** Commands continue through REST, and the UI always retains polling or manual refresh fallback.

## ADR-008: Local-first delivery destinations

**Decision:** Mailpit and a signed webhook receiver are complete P0 destinations; commercial adapters remain P1.

**Reason:** A reviewer must validate every success and failure flow without external accounts, cost, or network availability.

**Consequence:** The local receiver includes deterministic failure controls for portfolio evidence and automated tests.

## ADR-009: Encrypted message content with finite retention

**Decision:** Encrypt recipient and rendered content and erase payload ciphertext seven days after terminal state while retaining bounded metadata.

**Reason:** Notification content may be sensitive even when delivery metadata must remain auditable.

**Consequence:** Key management, retention jobs, masked UI projections, and redaction tests are P0 engineering work.

## ADR-010: Plain-text templates in P0

**Decision:** P0 templates render plain text subject and body with typed variables.

**Reason:** HTML sanitization, preview isolation, asset hosting, and visual editing would expand the security and product surface before delivery reliability is proven.

**Consequence:** HTML email design becomes a separate later capability; SMTP delivery remains fully demonstrable with text content.
