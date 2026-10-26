# ADR-0002: Short-lived in-memory access token + rotating HttpOnly refresh cookie

- **Status**: accepted
- **Date**: 2026-10-26

## Context

The SPA and the API are different origins. Options: (a) JWT in `localStorage`, (b) server sessions
with a cookie only, (c) access token in memory + refresh cookie.

## Decision

Option (c):

- Access token: JWT (HS256), 15 minutes, held in a JS variable only.
- Refresh token: 256-bit random, stored hashed, 30 days, rotated on every use, in a cookie that is
  `HttpOnly; Secure; SameSite=Strict; Path=/v1/auth`.
- Reuse of a rotated token outside a 10 s grace window revokes the whole family.
- Web and API are served from sibling subdomains so the cookie is same-site.

## Consequences

- XSS cannot steal a long-lived credential (no token in storage, cookie is HttpOnly).
- CSRF is mitigated by `SameSite=Strict`, CORS allow-list and an Origin check.
- Requires a shared registrable domain (documented in deployment).
- Most API calls need no database lookup to authenticate (stateless JWT). Revocation latency is up
  to 15 minutes for access tokens; sign-out-everywhere revokes refresh tokens immediately.
- The SPA restores the session on load with one `refresh` call (single-flight to survive React
  StrictMode and multiple tabs).
