# Deployment

Target topology:

| Piece            | Provider | Address |
| ---------------- | -------- | ------- |
| Web (React SPA)  | Vercel   | `https://kanbanzin.fabiobandacheski.com` |
| API (Fastify)    | Railway  | `https://api.kanbanzin.fabiobandacheski.com` |
| Database         | Railway PostgreSQL | private network (`*.railway.internal`) |
| Transactional e-mail | Resend | sender `no-reply@kanbanzin.fabiobandacheski.com` |

> The web and API hostnames must be subdomains of the **same registrable domain** — see
> [security.md](security.md#domain-requirement).

Deploy order for the first release: **database → API → web → DNS → e-mail domain**.

## 1. Railway (API + PostgreSQL)

1. Create a project and add the **PostgreSQL** plugin.
2. Add a service from this GitHub repository.
   - **Root Directory**: `apps/api` (Railway then reads `apps/api/railway.json`).
   - Build: `npm run build` · Pre-deploy: `npm run migrate` · Start: `npm run start` ·
     Health check: `/health/ready` (all set by `railway.json`).
3. Set the variables on the API service:

   | Variable | Value |
   | -------- | ----- |
   | `NODE_ENV` | `production` |
   | `DATABASE_URL` | Reference the Postgres variable: `${{Postgres.DATABASE_URL}}` |
   | `JWT_SECRET` | 48+ random bytes: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
   | `WEB_ORIGIN` | `https://kanbanzin.fabiobandacheski.com` |
   | `RESEND_API_KEY` | From the Resend dashboard |
   | `MAIL_FROM` | `Kanbanzin <no-reply@kanbanzin.fabiobandacheski.com>` |
   | `TRUST_PROXY_HOPS` | `1` (default) |
   | `LOG_LEVEL` | `info` |

   `PORT` is injected by Railway. The server refuses to boot in production without a valid
   `JWT_SECRET` and `RESEND_API_KEY`.
4. **Settings → Networking → Custom Domain**: add `api.kanbanzin.fabiobandacheski.com`. Railway shows
   a `CNAME` target (and, if requested, a TXT verification record).
5. (Recommended) Enable **Wait for CI** under Deploy settings so a push is only deployed when the
   GitHub checks pass.

Migrations run automatically before each release (`preDeployCommand`). A failed migration aborts
the deploy and leaves the previous version running.

## 2. Vercel (web)

1. Import the repository.
   - **Root Directory**: `apps/web`. Framework preset: Vite (also pinned in `vercel.json`).
2. Environment variables (Production):

   | Variable | Value |
   | -------- | ----- |
   | `VITE_API_URL` | `https://api.kanbanzin.fabiobandacheski.com` |
   | `VITE_CONTACT_EMAIL` | The address shown on the Privacy Policy (LGPD contact) |

   `VITE_*` values are baked at build time; redeploy after changing them.
3. **Domains**: add `kanbanzin.fabiobandacheski.com` and create the DNS record Vercel asks for
   (`CNAME` to `cname.vercel-dns.com` or the project-specific target).
4. `apps/web/vercel.json` already provides SPA rewrites and security headers. The CSP `connect-src`
   lists the production API origin — **edit it if you use a different API hostname**.
5. In Project Settings → Git, enable “Require CI to pass” (or protect `main`, see below).

## 3. DNS (at the registrar of `fabiobandacheski.com`)

| Type  | Name                 | Value                         |
| ----- | -------------------- | ----------------------------- |
| CNAME | `kanbanzin`          | target provided by Vercel     |
| CNAME | `api.kanbanzin`      | target provided by Railway    |
| (e-mail records)         | | see Resend below              |

## 4. Resend (password recovery e-mails)

1. Create an API key with “Sending access”.
2. Add and verify the domain `kanbanzin.fabiobandacheski.com` (or the parent domain). Publish the
   SPF, DKIM (and recommended DMARC) records Resend displays.
3. Put the key in `RESEND_API_KEY` and keep `MAIL_FROM` on the verified domain.

Test: request “Esqueci minha senha” on the live site with a registered address.

## 5. Continuous delivery

Two supported modes:

**A. Native Git integrations (default, simplest).** Railway and Vercel deploy `main` on every push.
Protect `main` in GitHub (require the `CI` checks) and enable “Wait for CI” in Railway so nothing
ships red. Pull requests get Vercel preview deployments automatically, but a preview lives on a
different origin (and a different site), so it cannot authenticate against the production API:
test changes locally or against a separate staging environment instead.

**B. GitHub Actions** (`.github/workflows/deploy.yml`). Enable by creating the repository variable
`ENABLE_ACTIONS_DEPLOY=true` and disabling the native auto-deploys. Required configuration:

| Kind | Name | Notes |
| ---- | ---- | ----- |
| Secret | `RAILWAY_TOKEN` | Project token for the production environment |
| Variable | `RAILWAY_SERVICE` | API service name |
| Secret | `VERCEL_TOKEN` | Account token |
| Secret | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | From `.vercel/project.json` after `vercel link` |

The workflow only runs after the `CI` workflow succeeded on `main`.

## 6. Branch protection and review flow

After the initial release every change goes through a Pull Request. Recommended `main` rules:
require a PR with 1 approval, require the status checks `API (lint, types, tests, build)`,
`API migrations on real PostgreSQL`, `Web (lint, types, tests, build)` and `Dependency audit`,
dismiss stale approvals, and block force pushes.

## 7. Operations

- **Rollback**: redeploy the previous deployment from the Railway/Vercel dashboard. Migrations are
  forward-only; write backwards-compatible migrations (add columns first, remove later) so the
  previous version keeps working during a rollback.
- **Backups**: enable Railway’s PostgreSQL backups (or schedule `pg_dump`). Account deletion is
  immediate in the live database; backups age out under your retention policy (document it).
- **Logs**: Railway → service → Logs. Keep at least 6 months of access logs (see
  [lgpd-compliance.md](lgpd-compliance.md)).
- **Scaling**: the API is stateless apart from the in-memory rate limiter. Before running more than
  one instance, move rate limiting to Redis (see [security.md](security.md#known-trade-offs)).

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| Browser console: CORS error | `WEB_ORIGIN` does not exactly match the site origin (scheme + host, no trailing slash) |
| Logged out on every page load | Web and API are not on the same registrable domain, or `NODE_ENV` is not `production` (cookie `Secure` flag) while using HTTPS |
| `403 forbidden_origin` on refresh/logout | Request `Origin` is not in `WEB_ORIGIN` |
| No reset e-mail | Domain not verified in Resend, wrong `MAIL_FROM`, or check the API logs for “Failed to send password reset e-mail” |
| Deploy fails at pre-deploy | Migration error; read the pre-deploy logs. The previous version keeps serving |
| CSP blocks API calls | `connect-src` in `apps/web/vercel.json` does not include the API hostname |
