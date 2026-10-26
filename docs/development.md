# Development guide

## Prerequisites

- Node.js **22 or newer** and npm 10+
- Git
- *(optional)* PostgreSQL 15+ — **not required**: the dev server and all tests can run on an
  embedded PostgreSQL (PGlite).

## Quick start (no database to install)

```bash
git clone https://github.com/fabioversaobeta/kanbanzin.git
cd kanbanzin
npm run install:all                       # installs apps/api and apps/web with npm ci

# terminal 1: API on http://localhost:3000 with an embedded, persistent PostgreSQL (.data/)
cd apps/api && npm run dev:pglite

# terminal 2: web on http://localhost:5173
cd apps/web && npm run dev
```

Open <http://localhost:5173>, create an account and start a board. Password-recovery e-mails are
printed in the API log (the `ConsoleMailer` is used when `RESEND_API_KEY` is empty).

## Using a real PostgreSQL

```bash
cd apps/api
cp .env.example .env         # set DATABASE_URL and a JWT_SECRET of 32+ characters
npm run build && node --env-file=.env dist/migrate.js
npm run dev                  # tsx watch
```

For the web app copy `apps/web/.env.example` to `apps/web/.env.local` if the API is not on
`http://localhost:3000`.

## Scripts

Run from the repository root (they delegate to both apps) or inside each app.

| Script                  | API | Web | Description |
| ----------------------- | :-: | :-: | ----------- |
| `npm run lint`          | ✔ | ✔ | ESLint (type-aware rules, no `console`, consistent type imports) |
| `npm run typecheck`     | ✔ | ✔ | `tsc --noEmit` in strict mode |
| `npm test`              | ✔ | ✔ | Vitest |
| `npm run build`         | ✔ | ✔ | API: tsup bundle · Web: type-check + Vite build |
| `npm run format`        | ✔ | ✔ | Prettier |
| `npm run test:unit` / `test:integration` | ✔ | | Split API suites |
| `npm run test:coverage` | ✔ | ✔ | V8 coverage |
| `npm run db:generate`   | ✔ | | Generate a SQL migration from schema changes |
| `npm run migrate`       | ✔ | | Apply migrations (needs a built `dist/`) |

## Testing strategy

| Level | Where | What it covers | Infra |
| ----- | ----- | -------------- | ----- |
| API unit | `apps/api/tests/unit` | Domain rules (email, password policy, ordering, colors, superpowers), use cases with in-memory fakes (lockout, token rotation and replay detection, reset flow), config validation, e-mail template escaping | none |
| API integration | `apps/api/tests/integration` | The real Fastify app with the real Drizzle repositories on **PGlite** (in-process PostgreSQL), driven through `app.inject`: auth, sessions, CSRF, password recovery, LGPD export/erasure, boards/lists/cards, ordering stress, tenant isolation, superpower gating, security headers, CORS, rate limiting | none |
| API on real PostgreSQL | CI job `API migrations on real PostgreSQL` | Migrations applied to PostgreSQL 17 and the built server booting and answering `/health/ready` | service container |
| Web unit/component | `apps/web/src/**/*.test.ts(x)` | Pure board-cache helpers, API client (refresh single-flight, retry, error mapping), superpower modules, auth pages (Testing Library) | jsdom |

Principles: test behaviour through public seams, fake only the ports (never Drizzle), keep tests
independent (unique e-mails per test; one PGlite per file).

## Conventions

- **Language**: code, comments, commits, docs and the repository are in English. End-user copy is
  pt-BR and lives in `apps/web/src/i18n/messages.ts` (and the legal pages).
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) —
  `feat(api): …`, `fix(web): …`, `docs: …`, `test(api): …`, `chore: …`, `ci: …`.
- **Branches and PRs**: work on a branch (`feat/…`, `fix/…`), open a PR using the template, wait for
  green CI and approval. `main` is deployable at all times. See [CONTRIBUTING.md](../CONTRIBUTING.md).
- **Style**: Prettier (single quotes, trailing commas, 100 cols) and ESLint must pass. Prefer small
  functions with intention-revealing names, no flag arguments, and comments that explain *why*.
- **Dependencies**: justify every new runtime dependency in the PR; prefer the platform and small,
  maintained libraries.

## Database migrations

1. Edit `apps/api/src/infrastructure/database/schema.ts`.
2. `npm run db:generate -- --name <what_changed>` (inside `apps/api`) and **review the SQL**.
3. Commit schema + `drizzle/` (including `meta/`) together. Integration tests apply all migrations
   on a fresh PGlite, so a broken migration fails the suite.
4. Keep migrations backwards compatible with the previously deployed version (expand → migrate →
   contract).

## Troubleshooting

- *`EADDRINUSE`* — another process uses port 3000 or 5173; set `PORT` (API) or pass `--port` to Vite.
- *Login works but reload logs me out in dev* — the API must be reachable at the same host name
  (`localhost`) the SPA uses; `WEB_ORIGIN` must match the SPA origin.
- *Reset the embedded database* — stop the dev server and delete `apps/api/.data`.
