# ZapX definition of done

ZapX is complete for the agreed local portfolio release only when every section below is satisfied.

## Product

- The P0 scope remains aligned with the product brief.
- Every P0 acceptance criterion has linked evidence.
- Owner, Operator, and Viewer permissions behave as documented, while developer access through API keys follows its separate authorization rules.
- A user can configure a local provider, create a template, submit a notification, and inspect its terminal result through the browser.
- A developer can complete the equivalent flow through the documented API.
- Success, transient failure, permanent failure, retry, dead letter, and replay are validated from the user perspective.

## Engineering

- Domain, application, infrastructure, and delivery responsibilities are separated.
- Each class, function, and module follows single responsibility.
- Production TypeScript files are no longer than 300 lines; test files are no longer than 1,000 lines.
- PostgreSQL remains the durable source of product and audit state.
- Notification and outbox records are committed atomically.
- Queue processing survives worker restart and handles duplicate execution safely.
- Provider adapters satisfy one documented contract.
- Database constraints, indexes, transaction boundaries, and retention rules are documented.

## Security

- Authentication and authorization tests cover positive and negative paths.
- Passwords, API keys, and provider credentials use the documented secure storage mechanisms.
- Sensitive values are masked from UI, logs, traces, errors, fixtures, and screenshots.
- Input validation, rate limiting, secure headers, CORS, cookie protection, and webhook signature verification are active.
- Dependency and secret scans report no unresolved release-blocking findings.

## Reliability and observability

- Retryability is classified explicitly and retries are bounded.
- Dead-letter and replay preserve historical attempts.
- Health, readiness, metrics, structured logs, and traces reflect actual runtime behavior.
- Correlation is visible across API, outbox, queue, worker, and provider boundaries.
- PostgreSQL, Redis, SMTP, webhook, and worker failure scenarios have verified user-visible behavior.
- Graceful shutdown and restart recovery are tested.

## User experience

- All primary pages include loading, empty, validation, success, and failure states where relevant.
- Responsive layouts pass the documented viewport checks.
- Keyboard navigation, focus visibility, form labels, error association, and contrast are verified.
- Technical errors are converted into safe, actionable messages.

## Testing and CI

- Unit tests cover domain rules and policies.
- Integration tests cover PostgreSQL, Redis, outbox, and queue behavior.
- Provider contract tests cover SMTP, webhook, and simulated adapters.
- API tests cover validation, authorization, idempotency, and failure responses.
- Browser tests cover the complete user flows.
- Load validation processes the documented 1,000-notification synthetic batch without missing logical records.
- Lint, formatting, strict typecheck, file-length checks, tests, and all required builds pass in CI.
- The final GitHub Actions run on `main` is green.

## Reproducibility

- A fresh clone follows the README successfully.
- `.env.example` documents every required setting without secrets.
- Lockfiles and container versions provide repeatable dependency resolution.
- Docker Compose starts the complete local product and supporting services.
- Synthetic seed data is safe and deterministic.
- No undocumented database edits or manual queue manipulation are needed.

## Documentation and portfolio

- README explains the problem, users, architecture, stack choices, workflows, testing, security, observability, setup, and limitations.
- Architecture, data model, API, state transitions, retry behavior, provider contract, security model, and engineering decisions are documented.
- Actual screenshots cover every important page and success or failure state.
- Each screenshot has filename, screen, purpose, user action, technical context, and result.
- Evidence is stored under `DevLab/Porto/ZapX/` using only relevant folders.
- Repository descriptions, topics, screenshot captions, and claims match the implementation.
- The project is committed, pushed, clean, and synchronized with `origin/main`.

## Release boundary

- Public deployment is not required.
- Resend, Twilio, campaigns, billing, organization invitations, and push notifications do not block completion.
- Any incomplete P0 behavior is documented as incomplete and prevents the product from being called finished.
