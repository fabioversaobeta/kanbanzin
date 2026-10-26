import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors';
import { activeCardFields } from '../../superpowers/domain/superpower';
import { parseCardLabels } from '../domain/card-labels';
import type { Card } from '../domain/entities';
import { placeAt } from '../domain/position';
import {
  CARD_TITLE_MAX,
  MAX_CARDS_PER_LIST,
  normalizeDescription,
  normalizeTitle,
} from '../domain/rules';
import type { CardPatch, CardRepository, EnabledSuperpowersReader, ListRepository } from './ports';
import { presentCard, type CardDto } from './presenters';

export class CreateCard {
  constructor(
    private readonly lists: ListRepository,
    private readonly cards: CardRepository,
    private readonly superpowers: EnabledSuperpowersReader,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: string, listId: string, input: { title: string }): Promise<CardDto> {
    const list = await this.lists.findOwned(listId, ownerId);
    if (!list) throw new NotFoundError('List');
    const title = normalizeTitle(input.title, CARD_TITLE_MAX, 'card title');

    const siblings = await this.cards.positions(list.id);
    if (siblings.length >= MAX_CARDS_PER_LIST) {
      throw new ConflictError(
        'limit_reached',
        `A list can have at most ${MAX_CARDS_PER_LIST} cards.`,
      );
    }
    const placement = placeAt(
      siblings.map((s) => s.position),
      siblings.length,
    );
    if (placement.reindexedSiblings) {
      await this.cards.setPositions(
        siblings.map((s, i) => ({ id: s.id, position: placement.reindexedSiblings![i]! })),
      );
    }
    const now = this.clock.now();
    const card: Card = {
      id: randomUUID(),
      boardId: list.boardId,
      listId: list.id,
      title,
      description: '',
      position: placement.position,
      dueAt: null,
      labels: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.cards.create(card);
    return presentCard(card, await this.superpowers.enabledKeys(list.boardId));
  }
}

export interface UpdateCardInput {
  title?: string;
  description?: string;
  /** ISO 8601 date-time, or null to clear. Requires the "due-dates" superpower. */
  dueAt?: string | null;
  /** Requires the "color-labels" superpower. */
  labels?: string[];
}

export class UpdateCard {
  constructor(
    private readonly cards: CardRepository,
    private readonly superpowers: EnabledSuperpowersReader,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: string, cardId: string, input: UpdateCardInput): Promise<CardDto> {
    const card = await this.cards.findOwned(cardId, ownerId);
    if (!card) throw new NotFoundError('Card');

    const enabled = await this.superpowers.enabledKeys(card.boardId);
    const allowed = activeCardFields(enabled);
    const patch: CardPatch = {};

    if (input.title !== undefined)
      patch.title = normalizeTitle(input.title, CARD_TITLE_MAX, 'card title');
    if (input.description !== undefined)
      patch.description = normalizeDescription(input.description);
    if (input.dueAt !== undefined) {
      this.requireSuperpower(allowed.has('dueAt'), 'due-dates');
      patch.dueAt = input.dueAt === null ? null : parseDueDate(input.dueAt);
    }
    if (input.labels !== undefined) {
      this.requireSuperpower(allowed.has('labels'), 'color-labels');
      patch.labels = parseCardLabels(input.labels);
    }

    const now = this.clock.now();
    await this.cards.update(card.id, patch, now);
    return presentCard({ ...card, ...patch, updatedAt: now }, enabled);
  }

  private requireSuperpower(isActive: boolean, key: string): void {
    if (!isActive) {
      throw new ValidationError(
        'superpower_disabled',
        `Enable the "${key}" superpower on this board first.`,
      );
    }
  }
}

function parseDueDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('invalid_due_date', 'Enter a valid due date.');
  }
  return date;
}

export class MoveCard {
  constructor(
    private readonly lists: ListRepository,
    private readonly cards: CardRepository,
    private readonly clock: Clock,
  ) {}

  /** Moves a card to `index` inside `listId` (the same list or another list of the same board). */
  async execute(
    ownerId: string,
    cardId: string,
    input: { listId: string; index: number },
  ): Promise<void> {
    const card = await this.cards.findOwned(cardId, ownerId);
    if (!card) throw new NotFoundError('Card');
    const target = await this.lists.findOwned(input.listId, ownerId);
    if (!target || target.boardId !== card.boardId) throw new NotFoundError('List');

    const siblings = await this.cards.positions(target.id, card.id);
    if (target.id !== card.listId && siblings.length >= MAX_CARDS_PER_LIST) {
      throw new ConflictError(
        'limit_reached',
        `A list can have at most ${MAX_CARDS_PER_LIST} cards.`,
      );
    }
    const placement = placeAt(
      siblings.map((s) => s.position),
      input.index,
    );
    if (placement.reindexedSiblings) {
      await this.cards.setPositions(
        siblings.map((s, i) => ({ id: s.id, position: placement.reindexedSiblings![i]! })),
      );
    }
    await this.cards.move(card.id, target.id, placement.position, this.clock.now());
  }
}

export class DeleteCard {
  constructor(private readonly cards: CardRepository) {}

  async execute(ownerId: string, cardId: string): Promise<void> {
    const card = await this.cards.findOwned(cardId, ownerId);
    if (!card) throw new NotFoundError('Card');
    await this.cards.delete(card.id);
  }
}
