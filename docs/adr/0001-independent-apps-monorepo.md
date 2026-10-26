# ADR-0001: One repository, two independent apps

- **Status**: accepted
- **Date**: 2026-10-26

## Context

The product needs a Node.js API (Railway) and a React SPA (Vercel). We want a single place for
issues, PRs and docs, but each platform builds from a *root directory*.

## Decision

Use a monorepo with `apps/api` and `apps/web`, each with its own `package.json` and lockfile and
**no shared workspace package**. The root `package.json` only delegates scripts.

## Consequences

- Railway (`Root Directory = apps/api`) and Vercel (`apps/web`) build with zero monorepo tooling.
- No workspace hoisting surprises; `npm ci` in each app is reproducible.
- API types are duplicated in `apps/web/src/api/types.ts`. The contract is small and covered by
  integration tests plus [api.md](../api.md). If it grows, extract an OpenAPI document or a
  generated client rather than a shared source package.
