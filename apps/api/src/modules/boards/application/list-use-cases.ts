import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock';
import { ConflictError, NotFoundError } from '../../../shared/errors';
import type { BoardList } from '../domain/entities';
import { placeAt } from '../domain/position';
import { LIST_TITLE_MAX, MAX_LISTS_PER_BOARD, normalizeTitle } from '../domain/rules';
import type { BoardRepository, CardRepository, ListRepository } from './ports';
import { presentList, type ListDto } from './presenters';

export class CreateList {
  constructor(
    private readonly boards: BoardRepository,
    private readonly lists: ListRepository,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: string, boardId: string, input: { title: string }): Promise<ListDto> {
    const board = await this.boards.findOwned(boardId, ownerId);
    if (!board) throw new NotFoundError('Board');
    const title = normalizeTitle(input.title, LIST_TITLE_MAX, 'list title');

    const siblings = await this.lists.positions(board.id);
    if (siblings.length >= MAX_LISTS_PER_BOARD) {
      throw new ConflictError(
        'limit_reached',
        `A board can have at most ${MAX_LISTS_PER_BOARD} lists.`,
      );
    }
    const placement = placeAt(
      siblings.map((s) => s.position),
      siblings.length,
    );
    if (placement.reindexedSiblings) {
      await this.lists.setPositions(
        siblings.map((s, i) => ({ id: s.id, position: placement.reindexedSiblings![i]! })),
      );
    }
    const list: BoardList = {
      id: randomUUID(),
      boardId: board.id,
      title,
      position: placement.position,
      createdAt: this.clock.now(),
    };
    await this.lists.create(list);
    return presentList(list);
  }
}

export class RenameList {
  constructor(private readonly lists: ListRepository) {}

  async execute(ownerId: string, listId: string, input: { title: string }): Promise<void> {
    const list = await this.lists.findOwned(listId, ownerId);
    if (!list) throw new NotFoundError('List');
    await this.lists.rename(list.id, normalizeTitle(input.title, LIST_TITLE_MAX, 'list title'));
  }
}

export class MoveList {
  constructor(private readonly lists: ListRepository) {}

  /** `index` is the zero-based slot among the board's other lists. */
  async execute(ownerId: string, listId: string, input: { index: number }): Promise<void> {
    const list = await this.lists.findOwned(listId, ownerId);
    if (!list) throw new NotFoundError('List');

    const siblings = await this.lists.positions(list.boardId, list.id);
    const placement = placeAt(
      siblings.map((s) => s.position),
      input.index,
    );
    const updates = [{ id: list.id, position: placement.position }];
    if (placement.reindexedSiblings) {
      siblings.forEach((s, i) =>
        updates.push({ id: s.id, position: placement.reindexedSiblings![i]! }),
      );
    }
    await this.lists.setPositions(updates);
  }
}

export class DeleteList {
  constructor(private readonly lists: ListRepository) {}

  async execute(ownerId: string, listId: string): Promise<void> {
    const list = await this.lists.findOwned(listId, ownerId);
    if (!list) throw new NotFoundError('List');
    await this.lists.delete(list.id);
  }
}

export class ArchiveListCards {
  constructor(
    private readonly lists: ListRepository,
    private readonly cards: CardRepository,
    private readonly clock: Clock,
  ) {}

  /** Clears the list without deleting it: its cards are archived and leave the board. */
  async execute(ownerId: string, listId: string): Promise<void> {
    const list = await this.lists.findOwned(listId, ownerId);
    if (!list) throw new NotFoundError('List');
    await this.cards.archiveByList(list.id, this.clock.now());
  }
}
