# ZapX API contract

This document describes the target P0 contract. The currently implemented subset is recorded in [Phase 4](phase-4-intake.md); unimplemented paths below are design commitments for later phases.

## Conventions

- Base path: `/v1`.
- JSON uses `snake_case` at the HTTP boundary.
- Resource identifiers are opaque UUID strings.
- Timestamps are UTC RFC 3339 strings.
- List endpoints use opaque cursor pagination with stable descending order.
- Errors use `application/problem+json` with stable `type`, `title`, `status`, `code`, `trace_id`, and optional field errors.
- Mutating browser requests require the session cookie and CSRF token.
- Machine requests use `Authorization: Bearer <api-key>`.
- Notification submission requires `Idempotency-Key`.

## Authentication

| Method | Path               | Purpose                                       |
| ------ | ------------------ | --------------------------------------------- |
| `POST` | `/v1/auth/login`   | Create access and rotating refresh session    |
| `POST` | `/v1/auth/refresh` | Rotate refresh session                        |
| `POST` | `/v1/auth/logout`  | Revoke current session family                 |
| `GET`  | `/v1/auth/me`      | Return current user and workspace permissions |

Login errors use one generic response for unknown users and incorrect passwords.

## Notifications

| Method | Path                            | Purpose                                |
| ------ | ------------------------------- | -------------------------------------- |
| `POST` | `/v1/notifications`             | Submit one transactional notification  |
| `GET`  | `/v1/notifications`             | Filter cursor-paginated notifications  |
| `GET`  | `/v1/notifications/{id}`        | Read notification and ordered attempts |
| `POST` | `/v1/notifications/{id}/replay` | Replay an authorized dead letter       |

### Submit request

```json
{
  "template_version_id": "0199...",
  "provider_connection_id": "0199...",
  "recipient": "recipient@example.test",
  "variables": {
    "first_name": "Naya",
    "reference": "ORDER-1042"
  }
}
```

### Accepted response

Status `202 Accepted`:

```json
{
  "id": "0199...",
  "status": "ACCEPTED",
  "status_url": "/v1/notifications/0199...",
  "trace_id": "4bf92f..."
}
```

Equivalent reuse of an idempotency key returns the original response and an `Idempotency-Replayed: true` header. Conflicting reuse returns `409 Conflict`.

### List filters

- `status`
- `channel`
- `provider_connection_id`
- `created_from`
- `created_to`
- `cursor`
- bounded `limit`

## Templates

| Method  | Path                                 | Purpose                               |
| ------- | ------------------------------------ | ------------------------------------- |
| `GET`   | `/v1/templates`                      | List templates                        |
| `POST`  | `/v1/templates`                      | Create template draft                 |
| `GET`   | `/v1/templates/{id}`                 | Read template and versions            |
| `PATCH` | `/v1/templates/{id}`                 | Update template metadata              |
| `POST`  | `/v1/templates/{id}/versions`        | Create version draft                  |
| `POST`  | `/v1/template-versions/{id}/preview` | Validate variables and render preview |
| `POST`  | `/v1/template-versions/{id}/publish` | Make a version immutable and usable   |

Published version mutation returns `409 Conflict`.

## Provider connections

| Method  | Path                         | Purpose                                    |
| ------- | ---------------------------- | ------------------------------------------ |
| `GET`   | `/v1/providers`              | List masked provider connections           |
| `POST`  | `/v1/providers`              | Create provider connection                 |
| `GET`   | `/v1/providers/{id}`         | Read masked configuration and health       |
| `PATCH` | `/v1/providers/{id}`         | Update allowed settings or rotate secrets  |
| `POST`  | `/v1/providers/{id}/test`    | Run bounded connection test                |
| `POST`  | `/v1/providers/{id}/disable` | Disable future use without erasing history |

Provider test responses expose category and safe guidance, never raw provider response bodies or credentials.

## API keys

| Method | Path                       | Purpose                           |
| ------ | -------------------------- | --------------------------------- |
| `GET`  | `/v1/api-keys`             | List non-secret API-key metadata  |
| `POST` | `/v1/api-keys`             | Create key and return secret once |
| `POST` | `/v1/api-keys/{id}/revoke` | Revoke key                        |

The creation response is never replayed after navigation. The UI requires an explicit acknowledgement that the secret has been copied.

## Audit and overview

| Method | Path               | Purpose                                               |
| ------ | ------------------ | ----------------------------------------------------- |
| `GET`  | `/v1/overview`     | Return counts, latency summaries, and recent failures |
| `GET`  | `/v1/audit-events` | Return authorized audit records                       |
| `GET`  | `/v1/events`       | Open workspace-scoped SSE status stream               |

SSE events contain identifiers and state summaries, not recipients, rendered content, or secrets.

## Operations

| Method | Path       | Purpose                                             |
| ------ | ---------- | --------------------------------------------------- |
| `GET`  | `/health`  | Liveness only                                       |
| `GET`  | `/ready`   | Required dependency readiness for the current phase |
| `GET`  | `/metrics` | Prometheus metrics on the internal local network    |
| `GET`  | `/docs`    | OpenAPI user interface in local mode                |

## Problem response example

```json
{
  "type": "https://zapx.local/problems/validation",
  "title": "The request could not be validated",
  "status": 422,
  "code": "VALIDATION_FAILED",
  "trace_id": "4bf92f...",
  "errors": [
    {
      "field": "variables.reference",
      "code": "REQUIRED",
      "message": "Reference is required by this template version."
    }
  ]
}
```

## Status semantics

- `400`: malformed protocol or JSON.
- `401`: missing or invalid authentication.
- `403`: authenticated principal lacks permission.
- `404`: resource absent within the caller's workspace; cross-workspace existence is not disclosed.
- `409`: idempotency conflict, immutable version mutation, or invalid state transition.
- `422`: structurally valid request fails domain validation.
- `429`: intake rate limit.
- `503`: required dependency cannot safely accept new work.

## Contract evolution

- Backward-compatible additions remain within `/v1`.
- Breaking behavior requires a new version or explicit deprecation window.
- Outbox and queue event payloads carry their own schema version.
- Generated clients are derived from the committed OpenAPI document and checked for drift in CI.
