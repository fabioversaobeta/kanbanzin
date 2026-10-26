# ADR-0004: PGlite for integration tests and local development

- **Status**: accepted
- **Date**: 2026-10-26

## Context

Integration tests should exercise real SQL (constraints, cascades, `ON CONFLICT`, array columns)
rather than mocks, but requiring Docker or a local PostgreSQL slows onboarding and CI.

## Decision

Use [PGlite](https://pglite.dev) (PostgreSQL compiled to WASM) in-process:

- every integration test file boots a fresh in-memory database and applies the real migrations;
- `npm run dev:pglite` gives a zero-install local server with a persistent database.

The production code depends on a driver-agnostic Drizzle type (`PgDatabase`), so the same
repositories run on `node-postgres` in production and PGlite in tests.

## Consequences

- Tests run in seconds with no external services and test the actual migrations.
- PGlite is single-connection, so concurrency/locking behaviour is not covered. A CI job therefore
  also applies migrations to **PostgreSQL 17** and boots the built server against it.
- Avoid PostgreSQL extensions that PGlite does not bundle.
