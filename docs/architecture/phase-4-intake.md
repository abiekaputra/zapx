# Phase 4 implementation record

## Objective

Phase 4 creates the durable acceptance boundary before any provider receives a message. It adds identity, workspace isolation, machine credentials, validated notification intake, encrypted persistence, and the transactional outbox.

## Implemented behavior

- Email and password login creates short-lived access and rotating refresh sessions.
- Browser credentials use `HttpOnly`, `SameSite=Strict` cookies; production cookies are `Secure`.
- Browser mutations require a matching CSRF cookie and `X-CSRF-Token` header.
- Refresh-token reuse revokes the complete token family.
- Owners can create, list, and revoke workspace-scoped API keys. The secret is returned once and only an Argon2id hash is stored.
- API clients can submit a validated notification with an `Idempotency-Key`.
- Template and provider lookups are scoped to the authenticated workspace.
- Required template variables are validated before any durable write.
- Recipient, subject, and body use AES-256-GCM encryption with workspace and notification associated data. A keyed HMAC supports recipient correlation without plaintext storage.
- One PostgreSQL transaction writes the notification, idempotency record, and versioned outbox event.
- Equivalent idempotent retries return the original response; conflicting payloads return `409`.
- API key lifecycle changes create audit events. Errors use safe `application/problem+json` responses.

## Implemented HTTP surface

| Method | Path                      | Authorization | Result                                      |
| ------ | ------------------------- | ------------- | ------------------------------------------- |
| `POST` | `/v1/auth/login`          | Public        | Session cookies and non-secret session data |
| `POST` | `/v1/auth/refresh`        | Refresh token | Rotated session cookies                     |
| `POST` | `/v1/auth/logout`         | Session       | Revokes the session family                  |
| `GET`  | `/v1/auth/me`             | Session       | Workspace-scoped identity                   |
| `GET`  | `/v1/api-keys`            | Owner         | Non-secret key metadata                     |
| `POST` | `/v1/api-keys`            | Owner         | Secret returned once                        |
| `POST` | `/v1/api-keys/:id/revoke` | Owner         | Revoked key metadata                        |
| `POST` | `/v1/notifications`       | Session/key   | `202` accepted or idempotent replay         |
| `GET`  | `/v1/notifications`       | Session/key   | Bounded safe metadata list                  |

Local OpenAPI documentation is available at `/docs`.

## Transaction boundary

The notification repository obtains a transaction-scoped advisory lock derived from the workspace, operation, and idempotency key. It then checks prior use, inserts the encrypted notification, inserts a versioned `notification.accepted` outbox event, and records the response snapshot before committing. Any validation or database error rolls back all three records.

## Verification evidence

- Domain tests cover schema validation, recipient normalization, required variables, and rendering.
- Security tests cover hashing, authenticated encryption, tamper rejection, and canonical request hashes.
- PostgreSQL integration tests cover migrations, session rotation and reuse detection, API key revocation, cross-workspace rejection, idempotent writes, encrypted storage, and notification/outbox cardinality.
- API integration tests cover generic login failures, secure browser cookies, CSRF rejection and acceptance, one-time API key disclosure, notification acceptance, replay, and conflict handling.
- CI runs the full quality gate, PostgreSQL integration suite, Compose validation, and independent secret scanning.

## Migration and rollback strategy

Migration `001_phase_4_foundation.sql` is repeat-safe through `schema_migrations` and installs a clean database. It intentionally has no destructive down migration. Local development can reset the disposable Compose volume and run migration plus seed again. For retained environments, rollback means stopping writers, restoring the pre-migration PostgreSQL backup, and deploying the previous application revision. Future schema changes use additive expand-and-contract migrations so old and new application versions can overlap safely.

## Known limits

- The web app is a truthful status surface; login and operator workflows are Phase 6.
- Provider and template management endpoints are not implemented. Synthetic seed records support local API evaluation.
- Accepted outbox events are not relayed. Redis execution, SMTP and webhook adapters, retries, attempts, and dead-letter recovery are Phase 5.
- Notification detail, cursor filters, replay, metrics, and rate limiting are not implemented.
- Readiness checks PostgreSQL only. Redis and worker checks become required with delivery execution.
- The product runs locally and has no public deployment.

## Phase 5 entry criteria

Phase 5 may start after local quality checks, PostgreSQL integration tests, GitHub CI, and secret scanning pass for this implementation record and the committed code.
