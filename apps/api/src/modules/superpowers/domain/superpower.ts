import { NotFoundError } from '../../../shared/errors';

/** Card attributes that a superpower may own. Fields owned by a disabled superpower are inert. */
export type CardField = 'dueAt' | 'labels';

/**
 * A superpower is a capability that can be switched on or off per board.
 * To add one: register it here, own its data fields, and add its UI module in the web app
 * (see docs/superpowers.md).
 */
export interface Superpower {
  key: string;
  name: string;
  description: string;
  cardFields: readonly CardField[];
}

export const SUPERPOWERS: readonly Superpower[] = [
  {
    key: 'due-dates',
    name: 'Due dates',
    description: 'Add a due date to cards and highlight the ones that are late.',
    cardFields: ['dueAt'],
  },
  {
    key: 'color-labels',
    name: 'Color labels',
    description: 'Tag cards with colored labels to group and scan them quickly.',
    cardFields: ['labels'],
  },
];

export function getSuperpower(key: string): Superpower {
  const superpower = SUPERPOWERS.find((s) => s.key === key);
  if (!superpower) throw new NotFoundError('Superpower');
  return superpower;
}

export function superpowerOwningField(field: CardField): Superpower | undefined {
  return SUPERPOWERS.find((s) => s.cardFields.includes(field));
}

/** Card fields the client may read and write given the superpowers enabled on a board. */
export function activeCardFields(enabledKeys: readonly string[]): ReadonlySet<CardField> {
  const fields = new Set<CardField>();
  for (const superpower of SUPERPOWERS) {
    if (enabledKeys.includes(superpower.key)) {
      superpower.cardFields.forEach((field) => fields.add(field));
    }
  }
  return fields;
}
