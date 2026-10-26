import { and, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/database/client';
import { passwordResetTokens, refreshTokens } from '../../../infrastructure/database/schema';
import type {
  PasswordResetRecord,
  PasswordResetRepository,
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../application/ports';

export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: Database) {}

  async create(record: RefreshTokenRecord): Promise<void> {
    await this.db.insert(refreshTokens).values(record);
  }

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const [row] = await this.db
      .select({
        id: refreshTokens.id,
        userId: refreshTokens.userId,
        familyId: refreshTokens.familyId,
        tokenHash: refreshTokens.tokenHash,
        expiresAt: refreshTokens.expiresAt,
        revokedAt: refreshTokens.revokedAt,
      })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async revoke(id: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(refreshTokens)
      .set({ revokedAt: at })
      .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)))
      .returning({ id: refreshTokens.id });
    return rows.length > 0;
  }

  async revokeFamily(familyId: string, at: Date): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: at })
      .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
  }

  async revokeAllForUser(userId: string, at: Date): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: at })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }
}

export class DrizzlePasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly db: Database) {}

  async create(record: PasswordResetRecord): Promise<void> {
    await this.db.insert(passwordResetTokens).values(record);
  }

  async findByHash(tokenHash: string): Promise<PasswordResetRecord | null> {
    const [row] = await this.db
      .select({
        id: passwordResetTokens.id,
        userId: passwordResetTokens.userId,
        tokenHash: passwordResetTokens.tokenHash,
        expiresAt: passwordResetTokens.expiresAt,
        usedAt: passwordResetTokens.usedAt,
      })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);
    return row ?? null;
  }

  async markUsed(id: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(passwordResetTokens)
      .set({ usedAt: at })
      .where(and(eq(passwordResetTokens.id, id), isNull(passwordResetTokens.usedAt)))
      .returning({ id: passwordResetTokens.id });
    return rows.length > 0;
  }

  async invalidateAllForUser(userId: string, at: Date): Promise<void> {
    await this.db
      .update(passwordResetTokens)
      .set({ usedAt: at })
      .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
  }
}
