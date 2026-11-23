import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/database/client';
import { personalAccessTokens } from '../../../infrastructure/database/schema';
import type {
  PersonalTokenRecord,
  PersonalTokenRepository,
} from '../application/personal-token-use-cases';

const columns = {
  id: personalAccessTokens.id,
  userId: personalAccessTokens.userId,
  name: personalAccessTokens.name,
  tokenPrefix: personalAccessTokens.tokenPrefix,
  tokenHash: personalAccessTokens.tokenHash,
  expiresAt: personalAccessTokens.expiresAt,
  lastUsedAt: personalAccessTokens.lastUsedAt,
  revokedAt: personalAccessTokens.revokedAt,
  createdAt: personalAccessTokens.createdAt,
};

export class DrizzlePersonalTokenRepository implements PersonalTokenRepository {
  constructor(private readonly db: Database) {}

  async create(record: PersonalTokenRecord): Promise<void> {
    await this.db.insert(personalAccessTokens).values(record);
  }

  async listActive(userId: string, now: Date): Promise<PersonalTokenRecord[]> {
    return this.db
      .select(columns)
      .from(personalAccessTokens)
      .where(
        and(
          eq(personalAccessTokens.userId, userId),
          isNull(personalAccessTokens.revokedAt),
          gt(personalAccessTokens.expiresAt, now),
        ),
      )
      .orderBy(desc(personalAccessTokens.createdAt));
  }

  async findByHash(tokenHash: string): Promise<PersonalTokenRecord | null> {
    const [row] = await this.db
      .select(columns)
      .from(personalAccessTokens)
      .where(eq(personalAccessTokens.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async revoke(id: string, userId: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(personalAccessTokens)
      .set({ revokedAt: at })
      .where(
        and(
          eq(personalAccessTokens.id, id),
          eq(personalAccessTokens.userId, userId),
          isNull(personalAccessTokens.revokedAt),
        ),
      )
      .returning({ id: personalAccessTokens.id });
    return rows.length > 0;
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.db
      .update(personalAccessTokens)
      .set({ lastUsedAt: at })
      .where(eq(personalAccessTokens.id, id));
  }
}
