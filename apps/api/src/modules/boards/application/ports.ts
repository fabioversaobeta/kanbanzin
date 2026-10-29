import type { Board, BoardList, Card, PositionedItem } from '../domain/entities';

export interface BoardSummary {
  id: string;
  title: string;
  color: string;
  updatedAt: Date;
}

export interface BoardRepository {
  listByOwner(ownerId: string): Promise<BoardSummary[]>;
  countByOwner(ownerId: string): Promise<number>;
  /** Resolves to null when the board does not exist or belongs to someone else. */
  findOwned(boardId: string, ownerId: string): Promise<Board | null>;
  create(board: Board): Promise<void>;
  update(id: string, patch: { title?: string; color?: string }, at: Date): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface BoardContentReader {
  /** Lists (ordered) and cards (ordered by list then position) of a board in two queries. */
  load(boardId: string): Promise<{ lists: BoardList[]; cards: Card[] }>;
}

export interface ListRepository {
  findOwned(listId: string, ownerId: string): Promise<BoardList | null>;
  /** Positions of the board's lists in ascending order, optionally leaving one list out. */
  positions(boardId: string, excludeId?: string): Promise<PositionedItem[]>;
  create(list: BoardList): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  setPositions(items: readonly PositionedItem[]): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface CardPatch {
  title?: string;
  description?: string;
  dueAt?: Date | null;
  labels?: string[];
}

export interface CardRepository {
  findOwned(cardId: string, ownerId: string): Promise<Card | null>;
  /** Positions of the list's cards in ascending order, optionally leaving one card out. */
  positions(listId: string, excludeId?: string): Promise<PositionedItem[]>;
  create(card: Card): Promise<void>;
  update(id: string, patch: CardPatch, at: Date): Promise<void>;
  move(id: string, listId: string, position: number, at: Date): Promise<void>;
  setPositions(items: readonly PositionedItem[]): Promise<void>;
  delete(id: string): Promise<void>;
  /** Archives every active card of the list; resolves to how many were archived. */
  archiveByList(listId: string, at: Date): Promise<number>;
}

export interface EnabledSuperpowersReader {
  enabledKeys(boardId: string): Promise<string[]>;
}
