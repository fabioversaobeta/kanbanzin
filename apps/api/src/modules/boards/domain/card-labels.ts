import { ValidationError } from '../../../shared/errors';

export const CARD_LABEL_PALETTE = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
] as const;

export function parseCardLabels(raw: readonly string[]): string[] {
  const unique = [...new Set(raw)];
  const valid = unique.every((label) => (CARD_LABEL_PALETTE as readonly string[]).includes(label));
  if (!valid) throw new ValidationError('invalid_label', 'Unknown label color.');
  return unique;
}
