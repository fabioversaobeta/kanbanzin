export const PALETTE = [
  'ocean',
  'sky',
  'mint',
  'forest',
  'sunset',
  'rose',
  'violet',
  'graphite',
] as const;

const GRADIENTS: Record<string, [string, string, string]> = {
  ocean: ['#1d4ed8', '#0ea5e9', '#6366f1'],
  sky: ['#0369a1', '#38bdf8', '#818cf8'],
  mint: ['#0f766e', '#2dd4bf', '#22c55e'],
  forest: ['#14532d', '#16a34a', '#65a30d'],
  sunset: ['#c2410c', '#f59e0b', '#db2777'],
  rose: ['#be123c', '#fb7185', '#c026d3'],
  violet: ['#5b21b6', '#8b5cf6', '#ec4899'],
  graphite: ['#1f2937', '#475569', '#334155'],
};

const HEX = /^#[0-9a-f]{6}$/i;

/** CSS `background` value for a board color (palette key or custom `#rrggbb`). */
export function boardBackground(color: string): string {
  const stops = GRADIENTS[color];
  if (stops) return `linear-gradient(135deg, ${stops[0]} 0%, ${stops[1]} 55%, ${stops[2]} 100%)`;
  if (HEX.test(color)) {
    return `linear-gradient(135deg, color-mix(in srgb, ${color} 62%, #000) 0%, ${color} 55%, color-mix(in srgb, ${color} 72%, #fff) 100%)`;
  }
  return boardBackground('ocean');
}

export function isHexColor(value: string): boolean {
  return HEX.test(value);
}
