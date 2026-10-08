# Phase 6 — operations console

Phase 6 turns the delivery engine into a product that an operator can use without database or queue access.

## Delivered surfaces

- responsive authenticated React shell with Owner, Operator, and Viewer navigation;
- real delivery overview populated from PostgreSQL and refreshed through SSE;
- notification composer with published templates, provider compatibility, variable inputs, and server-side preview;
- notification log with status, channel, provider, and date filters;
- detail drawer with masked recipient, rendered snapshot, trace identity, and ordered attempt history;
- encrypted provider creation, masked configuration readback, bounded connection testing, and disabling;
- template creation, immutable version creation, preview, and publication;
- one-time API key creation and revocation;
- append-only audit view for Owner and Viewer roles;
- visible refresh fallback when the live event stream disconnects.

## Backend support

The console uses dedicated provider, template, console, audit, and retention repositories. The API performs authorization before every query or command. Provider secrets remain AES-256-GCM ciphertext in PostgreSQL and never return to the browser after entry.

The public metrics endpoint emits Prometheus text for notification states, attempt outcomes, average queue wait, and average provider duration. Trace identities remain continuous across intake, outbox, queue, and attempts.

## Presentation work

The interface uses a small dark design system with a restrained green accent. A custom `Z + X + lightning` monogram identifies the application. Status capsules share one line-height and alignment rule, so state labels remain optically centered in metrics, tables, and timelines.

## Validation

API integration tests cover session rotation, role rejection, encrypted provider readback, failed provider tests, template publication, preview, notification detail, audit access, metrics, revoked keys, and API-key replay rejection. Component tests cover authentication state, while the complete browser journey is recorded in the Phase 7 evidence.
