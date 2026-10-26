export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface BoardSummary {
  id: string;
  title: string;
  color: string;
  updatedAt: string;
}

export interface Board {
  id: string;
  title: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Card {
  id: string;
  listId: string;
  title: string;
  description: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  /** Present only while the "due-dates" superpower is enabled. */
  dueAt?: string | null;
  /** Present only while the "color-labels" superpower is enabled. */
  labels?: string[];
}

export interface BoardList {
  id: string;
  title: string;
  position: number;
  cards: Card[];
}

export interface BoardView {
  board: Board;
  lists: BoardList[];
  superpowers: string[];
}

export interface CardUpdate {
  title?: string;
  description?: string;
  dueAt?: string | null;
  labels?: string[];
}
