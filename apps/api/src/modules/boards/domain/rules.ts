import { ValidationError } from '../../../shared/errors';

export const MAX_BOARDS_PER_USER = 100;
export const MAX_LISTS_PER_BOARD = 50;
export const MAX_CARDS_PER_LIST = 500;

export const BOARD_TITLE_MAX = 100;
export const LIST_TITLE_MAX = 100;
export const CARD_TITLE_MAX = 200;
export const CARD_DESCRIPTION_MAX = 10_000;

export function normalizeTitle(raw: string, max: number, field: string): string {
  const title = raw.trim().replace(/\s+/g, ' ');
  if (title.length < 1 || title.length > max) {
    throw new ValidationError(
      'invalid_title',
      `The ${field} must have between 1 and ${max} characters.`,
    );
  }
  return title;
}

export function normalizeDescription(raw: string): string {
  const description = raw.replace(/\r\n/g, '\n').trim();
  if (description.length > CARD_DESCRIPTION_MAX) {
    throw new ValidationError(
      'invalid_description',
      `The description must have at most ${CARD_DESCRIPTION_MAX} characters.`,
    );
  }
  return description;
}
