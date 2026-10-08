# ZapX P0 acceptance criteria

Each criterion must be verified through an automated test or a recorded end-user validation. Technical design may refine implementation details without weakening the behavior below.

## Authentication and authorization

- [ ] Given a valid seeded account, when the user signs in, then a secure session is created and the overview opens.
- [x] Given invalid credentials, when login is attempted, then the response does not reveal whether the email exists.
- [ ] Given an expired access session and valid refresh session, when the client renews, then the session rotates without requiring another login.
- [ ] Given a Viewer, when a mutation is attempted through UI or API, then the action is rejected.
- [x] Given an Owner, when an API key is created, then its secret is displayed once and only its hash is retained.
- [ ] Given a revoked API key, when it is used, then the request is rejected and no notification is created.

## Providers and templates

- [ ] Given valid SMTP configuration, when the Owner runs a connection test, then ZapX reports success without exposing the password.
- [ ] Given invalid provider configuration, when it is saved or tested, then the UI shows a safe actionable error and the provider is not marked ready.
- [ ] Given a template variable schema, when required variables are missing or invalid, then preview and submission identify the affected fields.
- [ ] Given a published template version, when it is used for delivery, then later template edits do not rewrite the historical rendered message.
- [x] Given webhook delivery, when ZapX sends the request, then the request includes a verifiable signature and timestamp.

## Notification intake

- [x] Given an authorized user or API key and a valid request, when a notification is submitted, then ZapX returns one notification identity and an accepted status.
- [x] Given one idempotency key and an equivalent request, when the request is repeated, then ZapX returns the original logical notification.
- [x] Given one idempotency key and a different payload, when the request is repeated, then ZapX rejects the conflict.
- [ ] Given invalid recipient, channel, provider, template, or variables, when submission occurs, then no notification or outbox event is committed.
- [x] Given a committed notification, then its outbox event exists in the same durable transaction.

## Queue and delivery

- [ ] Given an unpublished outbox event, when multiple relay instances compete, then only one queue publication is recorded.
- [ ] Given a queued job, when a worker restarts, then the job remains available for processing.
- [ ] Given an available local SMTP provider, when an email job is processed, then Mailpit receives the rendered message and ZapX records delivery.
- [ ] Given an available local webhook receiver, when a webhook job is processed, then the receiver validates the signature and ZapX records delivery.
- [ ] Given a configured provider limit, when work exceeds it, then excess jobs wait rather than bypassing the limit.
- [x] Given a successful provider response, then the notification reaches `DELIVERED` and cannot regress to an active state.

## Retry and recovery

- [x] Given a transient provider failure, when an attempt fails, then ZapX records the attempt and schedules the next bounded retry.
- [x] Given a permanent provider rejection, when an attempt fails, then ZapX does not perform automatic retries that the policy marks unsafe.
- [x] Given the retry limit is exhausted, then the notification reaches `DEAD_LETTER` with the complete attempt history retained.
- [x] Given a dead-letter notification and authorized operator, when replay is requested, then ZapX records the actor and creates a new attempt without deleting history.
- [ ] Given an unauthorized Viewer, when replay is requested, then the action is rejected and no job is created.

## Web product

- [ ] The overview shows queued, processing, delivered, retrying, failed, and dead-letter counts from actual product data.
- [ ] The notification list supports status, channel, provider, and time filters with a clear empty state.
- [ ] The composer supports template preview and field-level validation before submission.
- [ ] Notification detail shows request identity, channel, provider, status, timestamps, rendered content summary, and ordered attempt history.
- [ ] Live status changes appear without a full page reload while the connection is available.
- [ ] Loss of the live connection is visible and manual refresh remains available.
- [ ] Primary flows remain usable at the documented desktop and narrow responsive viewports.
- [ ] Keyboard focus, labels, error association, and color contrast satisfy the documented accessibility checks.

## Audit and security

- [ ] Login, provider changes, API key creation or revocation, template publication, and manual replay create audit records.
- [ ] Deleting or disabling an account does not remove the actor identity retained by historical audit records.
- [ ] Provider credentials are encrypted at rest and masked after entry.
- [ ] Logs, traces, errors, API responses, exports, and screenshots contain no raw credentials.
- [ ] Rate limits protect authentication and notification intake endpoints.
- [ ] Cross-workspace data access is rejected even when a valid record identifier is supplied.

## Operations and observability

- [x] Health reports process liveness without depending on every downstream service.
- [ ] Readiness reports unavailable when PostgreSQL, Redis, or required worker dependencies cannot support new work.
- [x] One correlation or trace identity connects notification intake, outbox publication, queue processing, and provider attempt.
- [ ] Metrics expose accepted notifications, terminal outcomes, retry count, dead-letter count, queue wait, and delivery duration.
- [ ] Graceful shutdown stops new work and safely completes or releases active work.

## Reproducibility and quality

- [ ] A fresh clone can start the documented local environment with synthetic data and no paid provider account.
- [ ] Database migration can install a clean database and roll back according to the documented strategy.
- [ ] Unit, integration, provider contract, API, browser end-to-end, and failure tests pass deterministically.
- [x] Lint, strict typecheck, source length check, tests, and builds pass in GitHub Actions.
- [ ] README, diagrams, API documentation, screenshots, and known limitations match the implemented product.
