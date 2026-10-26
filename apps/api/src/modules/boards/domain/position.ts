/**
 * Fractional ordering: every item stores a float `position` and siblings are sorted by it.
 * Moving an item only writes that one row (the midpoint between its new neighbours).
 * Siblings are reindexed only when the gap becomes too small for float precision.
 */
export const POSITION_STEP = 1024;
const MIN_GAP = 1e-6;

export interface Placement {
  /** Position to store on the moved or created item. */
  position: number;
  /** When set, siblings must be rewritten with these positions (same order as input). */
  reindexedSiblings: number[] | null;
}

function between(positions: readonly number[], index: number): number | null {
  const prev = positions[index - 1];
  const next = positions[index];
  if (prev === undefined && next === undefined) return POSITION_STEP;
  if (prev === undefined) return (next as number) - POSITION_STEP;
  if (next === undefined) return prev + POSITION_STEP;
  return next - prev < MIN_GAP ? null : (prev + next) / 2;
}

/**
 * Computes where an item lands when inserted at `index` among siblings that are already
 * sorted ascending (and do not include the item itself).
 */
export function placeAt(siblingPositions: readonly number[], index: number): Placement {
  const clamped = Math.max(0, Math.min(Math.trunc(index), siblingPositions.length));
  const direct = between(siblingPositions, clamped);
  if (direct !== null) return { position: direct, reindexedSiblings: null };

  const reindexed = siblingPositions.map((_, i) => (i + 1) * POSITION_STEP);
  return { position: between(reindexed, clamped) as number, reindexedSiblings: reindexed };
}
