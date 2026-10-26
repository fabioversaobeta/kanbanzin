export interface Board {
  id: string;
  ownerId: string;
  title: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BoardList {
  id: string;
  boardId: string;
  title: string;
  position: number;
  createdAt: Date;
}

export interface Card {
  id: string;
  boardId: string;
  listId: string;
  title: string;
  description: string;
  position: number;
  dueAt: Date | null;
  labels: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PositionedItem {
  id: string;
  position: number;
}
