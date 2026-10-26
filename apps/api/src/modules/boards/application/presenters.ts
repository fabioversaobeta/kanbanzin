import { activeCardFields } from '../../superpowers/domain/superpower';
import type { Board, BoardList, Card } from '../domain/entities';

export interface BoardDto {
  id: string;
  title: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface CardDto {
  id: string;
  listId: string;
  title: string;
  description: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  /** Present only while the "due-dates" superpower is enabled on the board. */
  dueAt?: string | null;
  /** Present only while the "color-labels" superpower is enabled on the board. */
  labels?: string[];
}

export interface ListDto {
  id: string;
  title: string;
  position: number;
  cards: CardDto[];
}

export function presentBoard(board: Board): BoardDto {
  return {
    id: board.id,
    title: board.title,
    color: board.color,
    createdAt: board.createdAt.toISOString(),
    updatedAt: board.updatedAt.toISOString(),
  };
}

export function presentList(list: BoardList, cards: CardDto[] = []): ListDto {
  return { id: list.id, title: list.title, position: list.position, cards };
}

/** Fields owned by disabled superpowers are omitted so clients cannot rely on them. */
export function presentCard(card: Card, enabledSuperpowers: readonly string[]): CardDto {
  const fields = activeCardFields(enabledSuperpowers);
  const dto: CardDto = {
    id: card.id,
    listId: card.listId,
    title: card.title,
    description: card.description,
    position: card.position,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
  if (fields.has('dueAt')) dto.dueAt = card.dueAt?.toISOString() ?? null;
  if (fields.has('labels')) dto.labels = card.labels;
  return dto;
}
