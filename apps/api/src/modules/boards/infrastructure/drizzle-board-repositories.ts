import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/database/client';
import { boards, cards, lists } from '../../../infrastructure/database/schema';
import type {
  BoardContentReader,
  BoardRepository,
  BoardSummary,
  CardPatch,
  CardRepository,
  ListRepository,
} from '../application/ports';
import type { Board, BoardList, Card, PositionedItem } from '../domain/entities';

export class DrizzleBoardRepository implements BoardRepository {
  constructor(private readonly db: Database) {}

  listByOwner(ownerId: string): Promise<BoardSummary[]> {
    return this.db
      .select({
        id: boards.id,
        title: boards.title,
        color: boards.color,
        updatedAt: boards.updatedAt,
      })
      .from(boards)
      .where(eq(boards.ownerId, ownerId))
      .orderBy(desc(boards.updatedAt));
  }

  async countByOwner(ownerId: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(boards)
      .where(eq(boards.ownerId, ownerId));
    return row?.total ?? 0;
  }

  async findOwned(boardId: string, ownerId: string): Promise<Board | null> {
    const [row] = await this.db
      .select()
      .from(boards)
      .where(and(eq(boards.id, boardId), eq(boards.ownerId, ownerId)))
      .limit(1);
    return row ?? null;
  }

  async create(board: Board): Promise<void> {
    await this.db.insert(boards).values(board);
  }

  async update(id: string, patch: { title?: string; color?: string }, at: Date): Promise<void> {
    await this.db
      .update(boards)
      .set({ ...patch, updatedAt: at })
      .where(eq(boards.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(boards).where(eq(boards.id, id));
  }
}

export class DrizzleBoardContentReader implements BoardContentReader {
  constructor(private readonly db: Database) {}

  async load(boardId: string): Promise<{ lists: BoardList[]; cards: Card[] }> {
    const [boardLists, boardCards] = await Promise.all([
      this.db.select().from(lists).where(eq(lists.boardId, boardId)).orderBy(asc(lists.position)),
      this.db
        .select()
        .from(cards)
        .where(and(eq(cards.boardId, boardId), isNull(cards.archivedAt)))
        .orderBy(asc(cards.position)),
    ]);
    return { lists: boardLists, cards: boardCards };
  }
}

export class DrizzleListRepository implements ListRepository {
  constructor(private readonly db: Database) {}

  async findOwned(listId: string, ownerId: string): Promise<BoardList | null> {
    const [row] = await this.db
      .select({
        id: lists.id,
        boardId: lists.boardId,
        title: lists.title,
        position: lists.position,
        createdAt: lists.createdAt,
      })
      .from(lists)
      .innerJoin(boards, eq(boards.id, lists.boardId))
      .where(and(eq(lists.id, listId), eq(boards.ownerId, ownerId)))
      .limit(1);
    return row ?? null;
  }

  positions(boardId: string, excludeId?: string): Promise<PositionedItem[]> {
    return this.db
      .select({ id: lists.id, position: lists.position })
      .from(lists)
      .where(
        excludeId
          ? and(eq(lists.boardId, boardId), ne(lists.id, excludeId))
          : eq(lists.boardId, boardId),
      )
      .orderBy(asc(lists.position));
  }

  async create(list: BoardList): Promise<void> {
    await this.db.insert(lists).values(list);
  }

  async rename(id: string, title: string): Promise<void> {
    await this.db.update(lists).set({ title }).where(eq(lists.id, id));
  }

  async setPositions(items: readonly PositionedItem[]): Promise<void> {
    await updatePositions(this.db, lists, items);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(lists).where(eq(lists.id, id));
  }
}

export class DrizzleCardRepository implements CardRepository {
  constructor(private readonly db: Database) {}

  async findOwned(cardId: string, ownerId: string): Promise<Card | null> {
    const [row] = await this.db
      .select({
        id: cards.id,
        boardId: cards.boardId,
        listId: cards.listId,
        title: cards.title,
        description: cards.description,
        position: cards.position,
        dueAt: cards.dueAt,
        labels: cards.labels,
        archivedAt: cards.archivedAt,
        createdAt: cards.createdAt,
        updatedAt: cards.updatedAt,
      })
      .from(cards)
      .innerJoin(boards, eq(boards.id, cards.boardId))
      .where(and(eq(cards.id, cardId), eq(boards.ownerId, ownerId), isNull(cards.archivedAt)))
      .limit(1);
    return row ?? null;
  }

  positions(listId: string, excludeId?: string): Promise<PositionedItem[]> {
    return this.db
      .select({ id: cards.id, position: cards.position })
      .from(cards)
      .where(
        excludeId
          ? and(eq(cards.listId, listId), isNull(cards.archivedAt), ne(cards.id, excludeId))
          : and(eq(cards.listId, listId), isNull(cards.archivedAt)),
      )
      .orderBy(asc(cards.position));
  }

  async create(card: Card): Promise<void> {
    await this.db.insert(cards).values(card);
  }

  async update(id: string, patch: CardPatch, at: Date): Promise<void> {
    await this.db
      .update(cards)
      .set({ ...patch, updatedAt: at })
      .where(eq(cards.id, id));
  }

  async move(id: string, listId: string, position: number, at: Date): Promise<void> {
    await this.db.update(cards).set({ listId, position, updatedAt: at }).where(eq(cards.id, id));
  }

  async setPositions(items: readonly PositionedItem[]): Promise<void> {
    await updatePositions(this.db, cards, items);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(cards).where(eq(cards.id, id));
  }

  async archiveByList(listId: string, at: Date): Promise<number> {
    const archived = await this.db
      .update(cards)
      .set({ archivedAt: at, updatedAt: at })
      .where(and(eq(cards.listId, listId), isNull(cards.archivedAt)))
      .returning({ id: cards.id });
    return archived.length;
  }
}

/** Rewrites many positions with a single `UPDATE ... FROM (VALUES ...)`-style statement. */
async function updatePositions(
  db: Database,
  table: typeof lists | typeof cards,
  items: readonly PositionedItem[],
): Promise<void> {
  if (items.length === 0) return;
  const cases = sql.join(
    items.map((item) => sql`WHEN ${table.id} = ${item.id} THEN ${item.position}::double precision`),
    sql` `,
  );
  await db
    .update(table)
    .set({ position: sql`CASE ${cases} END` })
    .where(
      inArray(
        table.id,
        items.map((item) => item.id),
      ),
    );
}
