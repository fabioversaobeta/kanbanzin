import type { User } from '../domain/user';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Throws ConflictError('email_taken') when the e-mail is already registered. */
  create(user: User): Promise<void>;
  updateName(id: string, name: string, at: Date): Promise<void>;
  updatePasswordHash(id: string, passwordHash: string, at: Date): Promise<void>;
  recordLoginFailure(id: string, failedLoginCount: number, lockedUntil: Date | null): Promise<void>;
  clearLoginFailures(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface RefreshTokenRepository {
  create(record: RefreshTokenRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /** Atomically revokes a token. Resolves to false when it was already revoked. */
  revoke(id: string, at: Date): Promise<boolean>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
  revokeAllForUser(userId: string, at: Date): Promise<void>;
}

export interface PasswordResetRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface PasswordResetRepository {
  create(record: PasswordResetRecord): Promise<void>;
  findByHash(tokenHash: string): Promise<PasswordResetRecord | null>;
  /** Atomically consumes a token. Resolves to false when it was already used. */
  markUsed(id: string, at: Date): Promise<boolean>;
  invalidateAllForUser(userId: string, at: Date): Promise<void>;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(passwordHash: string, password: string): Promise<boolean>;
}

export interface AccessTokenService {
  sign(userId: string): Promise<{ token: string; expiresInSeconds: number }>;
  /** Resolves to the user id, or null when the token is invalid or expired. */
  verify(token: string): Promise<string | null>;
}

export interface SecureTokenGenerator {
  generate(): { token: string; hash: string };
  hash(token: string): string;
}

export interface PasswordResetEmail {
  to: string;
  name: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export interface Mailer {
  sendPasswordReset(email: PasswordResetEmail): Promise<void>;
}
