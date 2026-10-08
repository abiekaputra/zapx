# Contributing to ZapX

## Development requirements

- Node.js 24
- pnpm 11
- Docker with Docker Compose for local infrastructure

## Setup

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm quality
```

Run infrastructure with `pnpm dev:infra` when a feature requires PostgreSQL, Redis, or Mailpit.

## Engineering rules

- Keep production TypeScript files at or below 300 lines and test files at or below 1,000 lines.
- Give each class, function, and module one clear responsibility.
- Add tests for meaningful success, boundary, and failure behavior.
- Keep secrets, real recipients, company data, and production credentials out of fixtures and commits.
- Update architecture or decision documentation when behavior or boundaries change.
- Use clear conventional commit messages.

## Pull requests

Explain the problem, implementation, validation, security impact, and documentation changes. A pull request is ready when `pnpm quality` passes and required CI checks are green.
