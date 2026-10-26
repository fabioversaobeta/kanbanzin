# Kanbanzin

[![CI](https://github.com/fabioversaobeta/kanbanzin/actions/workflows/ci.yml/badge.svg)](https://github.com/fabioversaobeta/kanbanzin/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A fast, secure, Trello-style Kanban app with an iOS **Liquid Glass** look. Create boards, lists and
cards, drag them around, give every board its own color and switch optional **superpowers** on or
off per board. Built with Node.js and React, designed for Brazilian privacy law (LGPD), and ready
to deploy on Railway (API) and Vercel (web).

> File uploads are intentionally **not** supported: no storage costs, no copyright or illegal
> content hosting risk, a smaller attack surface.

## Features

- **Boards, lists and cards** with smooth drag and drop (mouse, touch and keyboard), optimistic UI
- **Per-board color**: 8 curated gradients or any custom color
- **Superpowers**: plugin-like features enabled per board (included: *Due dates*, *Color labels*);
  the architecture is built so new ones can be added as the product grows
  ([guide](docs/superpowers.md))
- **Accounts** with e-mail/password, **password recovery by e-mail through Resend**
- **LGPD ready**: explicit consent, privacy policy and terms (pt-BR), data export, account erasure
- **Secure by default**: Argon2id, rotating refresh tokens, CSRF defences, rate limiting, strict
  security headers ([details](docs/security.md))
- **Liquid Glass UI**: translucent layers, blur and specular edges; responsive; accessible
  (keyboard, focus rings, reduced motion, ARIA)

## Tech stack

| Layer      | Technology |
| ---------- | ---------- |
| API        | Node.js 22+, TypeScript, **Fastify 5**, zod, **Drizzle ORM**, `pg`, `jose` (JWT), `@node-rs/argon2`, `resend`, pino |
| Database   | **PostgreSQL** (Railway); embedded PGlite for tests and zero-install local dev |
| Web        | **React 19**, TypeScript, Vite, React Router 7, **TanStack Query 5**, **@dnd-kit**, plain CSS design tokens (no UI framework) |
| Quality    | Vitest, Testing Library, ESLint, Prettier, strict TypeScript, GitHub Actions |
| Hosting    | Railway (API + PostgreSQL), Vercel (web), Resend (e-mail) |

### Architecture in short

- **Domain-Driven Design + hexagonal architecture** in the API: bounded contexts (`identity`,
  `boards`, `superpowers`, `privacy`), each split into `domain` (pure rules), `application` (use
  cases + ports) and `infrastructure` (adapters). A single composition root wires everything.
- **SOLID** through small use-case classes, dependency inversion via ports, and open/closed
  extension points (the superpower registry).
- **Performance**: indexed queries, a whole board in two queries, O(1) writes per move via fractional
  ordering, optimistic updates, lazy-loaded routes (~100 kB gzipped initial JS), no third-party
  scripts or fonts.
- **Sessions**: 15-minute in-memory JWT + HttpOnly rotating refresh cookie with reuse detection.

Deep dive: [docs/architecture.md](docs/architecture.md) and the [ADRs](docs/adr).

## Repository layout

```
apps/
  api/        Fastify API (src/, tests/, drizzle/ migrations, railway.json)
  web/        React SPA (src/, vercel.json)
docs/         Architecture, API, security, LGPD, deployment, development, ADRs
.github/      CI/CD workflows, Dependabot, PR template
```

## Getting started

Requires **Node.js 22+**. No database installation needed for development.

```bash
git clone https://github.com/fabioversaobeta/kanbanzin.git
cd kanbanzin
npm run install:all

# Terminal 1: API on :3000 (embedded PostgreSQL stored in apps/api/.data)
cd apps/api && npm run dev:pglite

# Terminal 2: web on :5173
cd apps/web && npm run dev
```

Open <http://localhost:5173>. In development, password-recovery e-mails are printed in the API log.
To use a real PostgreSQL instead, see [docs/development.md](docs/development.md).

### Common commands

```bash
npm run lint        # ESLint (API + web)
npm run typecheck   # strict TypeScript
npm test            # unit + integration tests (API) and component tests (web)
npm run build       # production builds
```

## Configuration

**API** (`apps/api/.env`, see `.env.example`)

| Variable | Required | Description |
| -------- | :------: | ----------- |
| `DATABASE_URL` | ✔ | PostgreSQL connection string |
| `JWT_SECRET` | ✔ | 32+ random characters used to sign access tokens |
| `WEB_ORIGIN` | ✔ | Allowed web origin(s), comma separated; also used in e-mail links |
| `RESEND_API_KEY` | prod | Resend API key (when empty, e-mails are logged instead; refused in production) |
| `MAIL_FROM` | | Sender, must belong to a Resend-verified domain |
| `NODE_ENV`, `PORT`, `LOG_LEVEL`, `TRUST_PROXY_HOPS` | | Runtime settings |

**Web** (`apps/web/.env.local`): `VITE_API_URL`, `VITE_CONTACT_EMAIL`.

## Testing

- **API unit** tests (domain rules, use cases with in-memory fakes)
- **API integration** tests: the real app and repositories on an in-process PostgreSQL (PGlite),
  covering auth, sessions, CSRF, password recovery, LGPD export/erasure, boards, ordering, tenant
  isolation, superpowers, security headers, CORS and rate limiting
- **Web** tests: board-cache logic, API client (token refresh), superpower modules, auth pages
- **CI** additionally applies the migrations to PostgreSQL 17 and boots the built server

See [docs/development.md](docs/development.md#testing-strategy).

## CI/CD and deployment

- GitHub Actions run lint, type-check, tests, build and a dependency audit on every push and PR
  ([`ci.yml`](.github/workflows/ci.yml)).
- `main` deploys to **Railway** (API, with migrations as a pre-deploy step and a readiness health
  check) and **Vercel** (web) through their Git integrations, or optionally through
  [`deploy.yml`](.github/workflows/deploy.yml).
- Production target: `https://kanbanzin.fabiobandacheski.com` (web) and
  `https://api.kanbanzin.fabiobandacheski.com` (API). Both must share the registrable domain.

Step-by-step instructions (Railway, Vercel, DNS, Resend): [docs/deployment.md](docs/deployment.md).

## Security and privacy

Security controls, threat model and operating notes live in [docs/security.md](docs/security.md);
how Brazilian law is addressed (LGPD, Marco Civil, CDC) in
[docs/lgpd-compliance.md](docs/lgpd-compliance.md). The legal texts shipped with the app are a
starting point and should be reviewed by a lawyer. Report vulnerabilities as described in
[SECURITY.md](SECURITY.md).

## Roadmap

Ideas that fit the current architecture: e-mail verification and MFA, board sharing and members,
more superpowers (checklists, WIP limits, card templates), activity log, board archive/duplicate,
Redis-backed rate limiting for horizontal scaling.

## Contributing

All changes go through Pull Requests with passing CI. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
