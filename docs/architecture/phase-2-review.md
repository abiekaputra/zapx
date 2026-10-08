# Phase 2 review

## Required outputs

- [x] Target architecture and component boundaries.
- [x] Technology baseline with reasons.
- [x] Repository and module boundaries.
- [x] Entity relationship model and important constraints.
- [x] Notification and attempt state machines.
- [x] REST, error, pagination, authentication, and SSE contracts.
- [x] Transactional outbox and duplicate-processing strategy.
- [x] Retry classification, rate limiting, dead letter, and replay behavior.
- [x] Authentication, authorization, encryption, webhook, SSRF, and telemetry security controls.
- [x] Health, readiness, logging, metrics, tracing, and retention design.
- [x] Engineering decisions and consequences.

## Phase 1 questions resolved

- Payload retention: encrypted content is erased seven days after terminal state; product metadata remains for 90 days and audit for 180 days.
- Console navigation: desktop operations layout with the route map in the technical specification; final visual density is refined during web implementation.
- Retry defaults: three automatic attempts using 5 seconds, 30 seconds, and 2 minutes with bounded jitter.
- Local secret encryption: an environment-supplied master-key adapter using AES-256-GCM and key versioning; hosted KMS remains replaceable.

## Consistency checks

- P0 still works without a paid or public provider.
- Redis is not treated as the product source of truth.
- Accepted work cannot be lost through an API-to-queue dual write.
- Exactly-once delivery is not claimed across external providers.
- Provider ambiguity has an explicit user-visible outcome.
- Cross-workspace, secret leakage, webhook SSRF, and replay abuse have designed controls.
- Commercial providers, scheduling, campaigns, billing, invitations, push, mobile, and deployment remain outside P0.

## Phase 3 entry decision

Phase 2 is complete. Phase 3 may create the repository foundation, lock exact versions, establish the workspace, start local infrastructure, and implement CI. Domain features must not be implemented ahead of the Phase 4 boundary.

## GitHub publication requirements for Phase 3

- Create the public repository as `abiekaputra/zapx` after the local foundation and first quality gates are ready.
- Use the About description: `Local-first notification delivery platform with durable queues, retries, signed webhooks, observability, and an operations console.`
- Apply relevant topics: `typescript`, `nestjs`, `react`, `postgresql`, `redis`, `bullmq`, `opentelemetry`, `notification-service`, and `portfolio`.
- Include an engineering-focused README, MIT license, security policy, contribution guide, environment example, architecture links, and verified setup commands in the first push.
- Include issue and pull-request templates, dependency updates, secret scanning workflow, source-length checks, lint, typecheck, tests, and required builds.
- Keep screenshots and social preview out of the initial foundation until they can be generated from the implemented product.
- Use meaningful commits and keep `main` green, clean, and synchronized after every completed phase.
