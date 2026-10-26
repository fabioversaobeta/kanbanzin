# ADR-0003: Fractional positions for ordering lists and cards

- **Status**: accepted
- **Date**: 2026-10-26

## Context

Kanban boards are reordered constantly. Storing a dense integer index forces renumbering many rows
per move, producing write amplification and conflicts under concurrency.

## Decision

Each list/card has a `double precision position`. Inserting between neighbours stores their
midpoint; first/last use ±1024. If the gap between neighbours falls below `1e-6`, the siblings are
reindexed (`1024 × n`) in one statement. Clients send the destination **index**, the server
computes the position (`placeAt` in `modules/boards/domain/position.ts`).

## Alternatives considered

- *Integer index with renumbering*: O(n) writes per move.
- *LexoRank strings*: no precision limit, but more complex and harder to query/debug.
- *Linked list (`next_id`)*: O(1) writes but awkward to query and repair.

## Consequences

- A move is a single-row `UPDATE` in the common case; a board loads with `ORDER BY position`.
- Reindexing is rare (needs dozens of consecutive inserts at the same spot) and covered by a unit
  test and an integration stress test.
- Clients do not depend on the numeric value, only on order.
