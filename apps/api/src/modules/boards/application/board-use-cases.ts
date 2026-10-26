import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock';
import { ConflictError, NotFoundError } from '../../../shared/errors';
import { DEFAULT_BOARD_COLOR, parseBoardColor } from '../domain/board-color';
import type { Board } from '../domain/entities';
import { BOARD_TITLE_MAX, MAX_BOARDS_PER_USER, normalizeTitle } from '../domain/rules';
import type {
  BoardContentReader,
  BoardRepository,
  BoardSummary,
  EnabledSuperpowersReader,
} from './ports';
import { presentBoard, presentCard, presentList, type BoardDto, type ListDto } from './presenters';

export class ListBoards {
  constructor(private readonly boards: BoardRepository) {}

  execute(ownerId: string): Promise<BoardSummary[]> {
    return this.boards.listByOwner(ownerId);
  }
}

export class CreateBoard {
  constructor(
    private readonly boards: BoardRepository,
    private readonly clock: Clock,
  ) {}

  async execute(ownerId: string, input: { title: string; color?: string }): Promise<BoardDto> {
    const title = normalizeTitle(input.title, BOARD_TITLE_MAX, 'board title');
    const color = parseBoardColor(input.color ?? DEFAULT_BOARD_COLOR);
    if ((await this.boards.countByOwner(ownerId)) >= MAX_BOARDS_PER_USER) {
      throw new ConflictError(
        'limit_reached',
        `You can have at most ${MAX_BOARDS_PER_USER} boards.`,
      );
    }
    const now = this.clock.now();
    const board: Board = {
      id: randomUUID(),
      ownerId,
      title,
      color,
      createdAt: now,
      updatedAt: now,
    };
    await this.boards.create(board);
    return presentBoard(board);
  }
}

export interface BoardView {
  board: BoardDto;
  lists: ListDto[];
  superpowers: string[];
}

export class GetBoard {
  constructor(
    private readonly boards: BoardRepository,
    private readonly content: BoardContentReader,
    private readonly superpowers: EnabledSuperpowersReader,
  ) {}

  async execute(ownerId: string, boardId: string): Promise<BoardView> {
    const board = await this.boards.findOwned(boardId, ownerId);
    if (!board) throw new NotFoundError('Board');

    const [{ lists, cards }, enabled] = await Promise.all([
      this.content.load(board.id),
      this.superpowers.enabledKeys(board.id),
    ]);

    const cardsByList = new Map<string, ReturnType<typeof presentCard>[]>();
    for (const card of cards) {
      const bucket = cardsByList.get(card.listId) ?? [];
      bucket.push(presentCard(card, enabled));
      cardsByList.set(card.listId, bucket);
    }
    return {
      board: presentBoard(board),
      lists: lists.map((list) => presentList(list, cardsByList.get(list.id) ?? [])),
      superpowers: enabled,
    };
  }
}

export class UpdateBoard {
  constructor(
    private readonly boards: BoardRepository,
    private readonly clock: Clock,
  ) {}

  async execute(
    ownerId: string,
    boardId: string,
    input: { title?: string; color?: string },
  ): Promise<BoardDto> {
    const board = await this.boards.findOwned(boardId, ownerId);
    if (!board) throw new NotFoundError('Board');

    const patch: { title?: string; color?: string } = {};
    if (input.title !== undefined)
      patch.title = normalizeTitle(input.title, BOARD_TITLE_MAX, 'board title');
    if (input.color !== undefined) patch.color = parseBoardColor(input.color);

    const now = this.clock.now();
    await this.boards.update(board.id, patch, now);
    return presentBoard({ ...board, ...patch, updatedAt: now });
  }
}

export class DeleteBoard {
  constructor(private readonly boards: BoardRepository) {}

  async execute(ownerId: string, boardId: string): Promise<void> {
    const board = await this.boards.findOwned(boardId, ownerId);
    if (!board) throw new NotFoundError('Board');
    await this.boards.delete(board.id);
  }
}
