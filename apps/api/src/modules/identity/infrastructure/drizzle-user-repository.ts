import { eq } from 'drizzle-orm';
import type { Database } from '../../../infrastructure/database/client';
import { isUniqueViolation } from '../../../infrastructure/database/errors';
import { users } from '../../../infrastructure/database/schema';
import { ConflictError } from '../../../shared/errors';
import type { UserRepository } from '../application/ports';
import type { User } from '../domain/user';

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return row ?? null;
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row ?? null;
  }

  async create(user: User): Promise<void> {
    try {
      await this.db.insert(users).values(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('email_taken', 'This e-mail is already registered.');
      }
      throw error;
    }
  }

  async updateName(id: string, name: string, at: Date): Promise<void> {
    await this.db.update(users).set({ name, updatedAt: at }).where(eq(users.id, id));
  }

  async updatePasswordHash(id: string, passwordHash: string, at: Date): Promise<void> {
    await this.db.update(users).set({ passwordHash, updatedAt: at }).where(eq(users.id, id));
  }

  async recordLoginFailure(
    id: string,
    failedLoginCount: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.db.update(users).set({ failedLoginCount, lockedUntil }).where(eq(users.id, id));
  }

  async clearLoginFailures(id: string): Promise<void> {
    await this.db
      .update(users)
      .set({ failedLoginCount: 0, lockedUntil: null })
      .where(eq(users.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }
}
