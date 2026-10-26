import { createHash } from 'node:crypto';
import type {
  AccessTokenService,
  Mailer,
  PasswordHasher,
  PasswordResetEmail,
  PasswordResetRecord,
  PasswordResetRepository,
  RefreshTokenRecord,
  RefreshTokenRepository,
  SecureTokenGenerator,
  UserRepository,
} from '../../src/modules/identity/application/ports';
import type { User } from '../../src/modules/identity/domain/user';
import type { Clock } from '../../src/shared/clock';
import { ConflictError } from '../../src/shared/errors';

export class MutableClock implements Clock {
  constructor(private current = new Date('2026-01-01T12:00:00Z')) {}
  now() {
    return new Date(this.current);
  }
  advance(ms: number) {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class InMemoryUsers implements UserRepository {
  readonly items = new Map<string, User>();
  async findByEmail(email: string) {
    return [...this.items.values()].find((u) => u.email === email) ?? null;
  }
  async findById(id: string) {
    return this.items.get(id) ?? null;
  }
  async create(user: User) {
    if (await this.findByEmail(user.email)) throw new ConflictError('email_taken', 'taken');
    this.items.set(user.id, user);
  }
  async updateName(id: string, name: string) {
    this.items.set(id, { ...this.items.get(id)!, name });
  }
  async updatePasswordHash(id: string, passwordHash: string) {
    this.items.set(id, { ...this.items.get(id)!, passwordHash });
  }
  async recordLoginFailure(id: string, failedLoginCount: number, lockedUntil: Date | null) {
    this.items.set(id, { ...this.items.get(id)!, failedLoginCount, lockedUntil });
  }
  async clearLoginFailures(id: string) {
    this.items.set(id, { ...this.items.get(id)!, failedLoginCount: 0, lockedUntil: null });
  }
  async delete(id: string) {
    this.items.delete(id);
  }
}

export class InMemoryRefreshTokens implements RefreshTokenRepository {
  readonly items: RefreshTokenRecord[] = [];
  async create(record: RefreshTokenRecord) {
    this.items.push({ ...record });
  }
  async findByHash(tokenHash: string) {
    return this.items.find((t) => t.tokenHash === tokenHash) ?? null;
  }
  async revoke(id: string, at: Date) {
    const token = this.items.find((t) => t.id === id);
    if (!token || token.revokedAt) return false;
    token.revokedAt = at;
    return true;
  }
  async revokeFamily(familyId: string, at: Date) {
    this.items
      .filter((t) => t.familyId === familyId && !t.revokedAt)
      .forEach((t) => (t.revokedAt = at));
  }
  async revokeAllForUser(userId: string, at: Date) {
    this.items
      .filter((t) => t.userId === userId && !t.revokedAt)
      .forEach((t) => (t.revokedAt = at));
  }
}

export class InMemoryPasswordResets implements PasswordResetRepository {
  readonly items: PasswordResetRecord[] = [];
  async create(record: PasswordResetRecord) {
    this.items.push({ ...record });
  }
  async findByHash(tokenHash: string) {
    return this.items.find((t) => t.tokenHash === tokenHash) ?? null;
  }
  async markUsed(id: string, at: Date) {
    const token = this.items.find((t) => t.id === id);
    if (!token || token.usedAt) return false;
    token.usedAt = at;
    return true;
  }
  async invalidateAllForUser(userId: string, at: Date) {
    this.items.filter((t) => t.userId === userId && !t.usedAt).forEach((t) => (t.usedAt = at));
  }
}

/** Not secure: keeps unit tests instant. The real hasher is covered by integration tests. */
export class FakeHasher implements PasswordHasher {
  async hash(password: string) {
    return `hashed:${password}`;
  }
  async verify(passwordHash: string, password: string) {
    return passwordHash === `hashed:${password}`;
  }
}

export class FakeAccessTokens implements AccessTokenService {
  async sign(userId: string) {
    return { token: `access:${userId}`, expiresInSeconds: 900 };
  }
  async verify(token: string) {
    return token.startsWith('access:') ? token.slice(7) : null;
  }
}

export class SequentialTokenGenerator implements SecureTokenGenerator {
  private counter = 0;
  generate() {
    this.counter += 1;
    const token = `token-${this.counter}`;
    return { token, hash: this.hash(token) };
  }
  hash(token: string) {
    return createHash('sha1').update(token).digest('hex');
  }
}

export class RecordingMailer implements Mailer {
  readonly sent: PasswordResetEmail[] = [];
  async sendPasswordReset(email: PasswordResetEmail) {
    this.sent.push(email);
  }
}
