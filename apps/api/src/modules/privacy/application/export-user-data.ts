import { asc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/database/client';
import { boardSuperpowers, boards, cards, lists } from '../../../infrastructure/database/schema';
import { NotFoundError } from '../../../shared/errors';
import type { Clock } from '../../../shared/clock';
import type { UserRepository } from '../../identity/application/ports';

/**
 * LGPD art. 18, II and V: gives data subjects a copy of their data in a structured,
 * machine-readable format (JSON).
 */
export class ExportUserData {
  constructor(
    private readonly db: Database,
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User');

    const userBoards = await this.db.select().from(boards).where(eq(boards.ownerId, userId));
    const boardIds = userBoards.map((b) => b.id);
    const [userLists, userCards, userSuperpowers] = boardIds.length
      ? await Promise.all([
          this.db
            .select()
            .from(lists)
            .where(inArray(lists.boardId, boardIds))
            .orderBy(asc(lists.position)),
          this.db
            .select()
            .from(cards)
            .where(inArray(cards.boardId, boardIds))
            .orderBy(asc(cards.position)),
          this.db
            .select()
            .from(boardSuperpowers)
            .where(inArray(boardSuperpowers.boardId, boardIds)),
        ])
      : [[], [], []];

    return {
      exportedAt: this.clock.now().toISOString(),
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
        termsVersion: user.termsVersion,
        termsAcceptedAt: user.termsAcceptedAt.toISOString(),
      },
      boards: userBoards.map((board) => ({
        id: board.id,
        title: board.title,
        color: board.color,
        createdAt: board.createdAt.toISOString(),
        superpowers: userSuperpowers.filter((s) => s.boardId === board.id).map((s) => s.key),
        lists: userLists
          .filter((list) => list.boardId === board.id)
          .map((list) => ({
            id: list.id,
            title: list.title,
            cards: userCards
              .filter((card) => card.listId === list.id)
              .map((card) => ({
                id: card.id,
                title: card.title,
                description: card.description,
                dueAt: card.dueAt?.toISOString() ?? null,
                labels: card.labels,
                createdAt: card.createdAt.toISOString(),
              })),
          })),
      })),
    };
  }
}
