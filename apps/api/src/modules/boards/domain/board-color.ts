import { ValidationError } from '../../../shared/errors';

/** Curated palette. Each key maps to a gradient in the web app. */
export const BOARD_COLOR_PALETTE = [
  'ocean',
  'sky',
  'mint',
  'forest',
  'sunset',
  'rose',
  'violet',
  'graphite',
] as const;

export const DEFAULT_BOARD_COLOR = 'ocean';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** A board color is either a palette key or a custom `#rrggbb` hex value. */
export function parseBoardColor(raw: string): string {
  const value = raw.trim();
  if ((BOARD_COLOR_PALETTE as readonly string[]).includes(value)) return value;
  if (HEX_COLOR.test(value)) return value.toLowerCase();
  throw new ValidationError('invalid_color', 'Choose a palette color or a #rrggbb value.');
}
