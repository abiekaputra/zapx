# ZapX security model

## Protected assets

- Password hashes and browser sessions.
- API keys and provider credentials.
- Recipient identifiers and rendered message content.
- Workspace configuration, templates, delivery history, and audit events.
- Webhook signing keys.
- Integrity of notification status and attempt history.

## Trust boundaries

1. Browser to web/API boundary.
2. Machine client to API boundary.
3. API and worker to PostgreSQL boundary.
4. Relay and worker to Redis boundary.
5. Worker to external provider boundary.
6. Application processes to telemetry boundary.
7. Local developer environment to committed repository boundary.

## Authentication

### Browser users

- Passwords use Argon2id with parameters selected through a documented local benchmark.
- Short-lived access state and rotating refresh-token families are stored in secure, HTTP-only, same-site cookies.
- Refresh tokens are stored as hashes and reuse revokes the family.
- Login responses do not disclose account existence.
- State-changing browser requests require CSRF protection.

### Machine clients

- API key secret is generated with a cryptographically secure random source and shown once.
- Database stores a non-secret prefix for lookup and a slow hash for verification.
- Keys have scopes, optional expiry, last-used metadata, and immediate revocation.
- Raw keys never enter logs, traces, analytics, or audit metadata.

## Authorization

- Every workspace-owned query receives workspace identity from authenticated context rather than request body.
- Repository methods require workspace identity and never expose an unscoped lookup to application services.
- Roles are deny-by-default: Owner, Operator, and Viewer.
- Machine access is scope-based and cannot use browser-only administrative operations.
- Cross-workspace access returns the same not-found behavior as an absent record.

## Secret encryption

- Provider credentials, webhook signing secrets, recipient, and rendered content use authenticated encryption with AES-256-GCM.
- The local master key is supplied through environment configuration and never persisted in the repository or database.
- Ciphertext stores nonce and key version; associated data binds workspace, record, field, and provider identity.
- Key rotation decrypts with the old version and re-encrypts through an explicit audited operation.
- P0 documents a local master-key adapter; a future hosted environment can replace it with KMS without changing domain services.

## Webhook protection

- Outbound requests include delivery identity, timestamp, and HMAC-SHA-256 signature over versioned canonical bytes.
- The local receiver rejects stale timestamps, invalid signatures, and duplicate delivery identities.
- Redirects are disabled in P0.
- Destination resolution rejects loopback, link-local, private, multicast, and cloud metadata ranges by default.
- Local mode permits only the configured Docker service allowlist for the test receiver; it does not enable arbitrary localhost URLs.
- DNS is resolved and validated at connection time to reduce rebinding risk.
- Request size, response size, connect timeout, and total timeout are bounded.

## Application security controls

- Zod validates all HTTP, environment, event, and provider-boundary inputs.
- SQL is issued through parameterized persistence APIs.
- React escapes content; rendered template preview is plain text in P0.
- Content Security Policy, frame protection, secure MIME settings, and conservative referrer policy are enabled.
- CORS allows only the configured web origin.
- Cookies use secure settings appropriate to the active local or hosted profile.
- Uploaded files and arbitrary HTML templates are outside P0.
- Error responses contain stable safe codes and trace identity without stack traces.

## Logging and telemetry

- Logger redaction covers authorization, cookies, secrets, recipients, rendered content, and provider configuration.
- Recipient, API key, message body, and high-cardinality notification identity are not metric labels.
- Trace attributes use workspace-safe internal identifiers and operation summaries.
- Provider response bodies are sanitized and truncated before persistence or logging.
- Development stack traces remain server-side and never enter HTTP responses.

## Audit integrity

- Audit rows are append-only through application permissions.
- Sensitive actions retain actor type, stable actor label, target, action, time, and trace identity.
- Audit metadata contains changed field names and outcomes rather than secret values.
- Account or key revocation does not erase historical actor labels.

## Threat analysis

| Threat                           | Control                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| Credential theft from repository | Environment-only secrets, secret scan, synthetic fixtures                        |
| API-key database disclosure      | Prefix plus slow hash; secret shown once                                         |
| Cross-workspace access           | Authenticated workspace context and scoped repositories                          |
| Duplicate client submission      | Scoped idempotency record and canonical request hash                             |
| Queue-message tampering          | Internal network boundary, minimal versioned payload, durable state revalidation |
| Webhook SSRF                     | Network-range validation, allowlist, no redirects, bounded response              |
| Webhook spoofing                 | Timestamped HMAC signature and receiver deduplication                            |
| XSS through message content      | Plain-text preview and default React escaping                                    |
| CSRF                             | Same-site cookies plus explicit token on mutations                               |
| Brute-force login                | Generic response, rate limit, audit, and account-safe backoff                    |
| Secret leakage in telemetry      | Central redaction and tests against serialized output                            |
| Privileged replay abuse          | Role check, explicit action, audit record, retained attempts                     |
| Unbounded resource consumption   | Request limits, pagination, rate limits, queue backlog threshold                 |

## Security verification

- Authorization matrix tests for each route.
- Cross-workspace object identifier tests.
- Session rotation and reuse detection tests.
- API-key hashing, expiry, scope, and revocation tests.
- Encryption round-trip, wrong associated data, and key rotation tests.
- SSRF tests for alternate IP representations, DNS changes, redirects, and metadata addresses.
- Log and trace redaction snapshot tests.
- Webhook signature, replay-window, and duplicate-delivery tests.
- Dependency audit and repository secret scan in CI.
