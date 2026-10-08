# Phase 7 — end-to-end validation and portfolio evidence

The release was validated from the product surface rather than through isolated endpoints alone.

## Recorded browser journey

Playwright performs this journey in Google Chrome:

1. open the local product and sign in as the synthetic Owner;
2. inspect actual dashboard counts;
3. confirm the ready Mailpit and webhook providers;
4. inspect the published `Order ready` template;
5. select the SMTP provider, fill synthetic variables, and preview content;
6. submit one notification through the web console;
7. wait for the newest matching row to reach `DELIVERED` through live updates;
8. inspect the masked recipient, rendered snapshot, trace identity, and successful attempt;
9. confirm the message exists in the Mailpit inbox;
10. inspect API-key and audit surfaces;
11. repeat the overview check at a 390 × 844 viewport.

The test saves full-page JPEG evidence under `DevLab/Porto/ZapX/screenshots/`.

## Automated verification

| Gate              | Evidence                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Code structure    | Automated 300-line production and 1,000-line test limits                                                               |
| Readability       | Prettier check and ESLint with zero warnings                                                                           |
| Type safety       | Strict TypeScript build across packages and applications                                                               |
| Behavior          | Unit, component, contract, API, PostgreSQL, Redis/BullMQ, SMTP, and browser tests                                      |
| Load              | 1,000 unique synthetic notifications move from accepted through outbox and terminal delivery state without record loss |
| Infrastructure    | Docker Compose model validation with pinned PostgreSQL, Redis, and Mailpit images                                      |
| Repository safety | Dedicated GitHub Actions history secret scan                                                                           |

## Honest boundary

The validation uses local PostgreSQL, Redis, Mailpit, and a purpose-built signed webhook receiver. It proves the complete local product path. It does not claim public availability, production scale, or third-party provider certification.
