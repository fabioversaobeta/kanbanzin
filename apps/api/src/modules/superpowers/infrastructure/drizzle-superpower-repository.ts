import { and, eq } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/database/client';
import { boardSuperpowers } from '../../../infrastructure/database/schema';
import type { EnabledSuperpowersReader } from '../../boards/application/ports';
import type { SuperpowerRepository } from '../application/superpower-use-cases';

export class DrizzleSuperpowerRepository implements SuperpowerRepository, EnabledSuperpowersReader {
  constructor(private readonly db: Database) {}

  async enabledKeys(boardId: string): Promise<string[]> {
    const rows = await this.db
      .select({ key: boardSuperpowers.key })
      .from(boardSuperpowers)
      .where(eq(boardSuperpowers.boardId, boardId));
    return rows.map((row) => row.key).sort();
  }

  async setEnabled(boardId: string, key: string, enabled: boolean): Promise<void> {
    if (enabled) {
      await this.db.insert(boardSuperpowers).values({ boardId, key }).onConflictDoNothing();
      return;
    }
    await this.db
      .delete(boardSuperpowers)
      .where(and(eq(boardSuperpowers.boardId, boardId), eq(boardSuperpowers.key, key)));
  }
}
