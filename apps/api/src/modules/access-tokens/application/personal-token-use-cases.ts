import { randomUUID } from 'node:crypto';
import type { SecureTokenGenerator } from '../../identity/application/ports';
import type { Clock } from '../../../shared/clock';
import { ConflictError, NotFoundError, ValidationError } from '../../../shared/errors';

/** Lets the auth guard tell personal tokens apart from session JWTs without parsing them. */
export const PERSONAL_TOKEN_PREFIX = 'kbz_';
export const TOKEN_NAME_MAX = 100;
export const MAX_ACTIVE_TOKENS_PER_USER = 20;
export const DEFAULT_TOKEN_TTL_DAYS = 90;
export const MAX_TOKEN_TTL_DAYS = 365;
const LAST_USED_GRANULARITY_MS = 5 * 60 * 1000;
const DISPLAY_PREFIX_LENGTH = PERSONAL_TOKEN_PREFIX.length + 4;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PersonalTokenRecord {
  id: string;
  userId: string;
  name: string;
  tokenPrefix: string;
  tokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface PersonalTokenRepository {
  create(record: PersonalTokenRecord): Promise<void>;
  /** Tokens that are neither revoked nor expired, newest first. */
  listActive(userId: string, now: Date): Promise<PersonalTokenRecord[]>;
  findByHash(tokenHash: string): Promise<PersonalTokenRecord | null>;
  /** Resolves to false when the token does not exist, is not the user's, or is already revoked. */
  revoke(id: string, userId: string, at: Date): Promise<boolean>;
  touch(id: string, at: Date): Promise<void>;
}

export interface PersonalTokenDto {
  id: string;
  name: string;
  prefix: string;
  expiresAt: string;
  lastUsedAt: string | null;
  createdAt: string;
}

function present(record: PersonalTokenRecord): PersonalTokenDto {
  return {
    id: record.id,
    name: record.name,
    prefix: record.tokenPrefix,
    expiresAt: record.expiresAt.toISOString(),
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

export class CreatePersonalToken {
  constructor(
    private readonly tokens: PersonalTokenRepository,
    private readonly generator: SecureTokenGenerator,
    private readonly clock: Clock,
  ) {}

  /** The raw token is returned once and never stored: only its SHA-256 digest is. */
  async execute(
    userId: string,
    input: { name: string; expiresInDays?: number },
  ): Promise<{ token: PersonalTokenDto; secret: string }> {
    const name = input.name.trim();
    if (!name || name.length > TOKEN_NAME_MAX) {
      throw new ValidationError(
        'invalid_name',
        `The token name must have 1 to ${TOKEN_NAME_MAX} characters.`,
      );
    }
    const days = input.expiresInDays ?? DEFAULT_TOKEN_TTL_DAYS;
    if (!Number.isInteger(days) || days < 1 || days > MAX_TOKEN_TTL_DAYS) {
      throw new ValidationError(
        'invalid_expiry',
        `The expiry must be between 1 and ${MAX_TOKEN_TTL_DAYS} days.`,
      );
    }

    const now = this.clock.now();
    const active = await this.tokens.listActive(userId, now);
    if (active.length >= MAX_ACTIVE_TOKENS_PER_USER) {
      throw new ConflictError(
        'limit_reached',
        `You can have at most ${MAX_ACTIVE_TOKENS_PER_USER} active tokens. Revoke one first.`,
      );
    }

    const secret = `${PERSONAL_TOKEN_PREFIX}${this.generator.generate().token}`;
    const record: PersonalTokenRecord = {
      id: randomUUID(),
      userId,
      name,
      tokenPrefix: secret.slice(0, DISPLAY_PREFIX_LENGTH),
      tokenHash: this.generator.hash(secret),
      expiresAt: new Date(now.getTime() + days * DAY_MS),
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
    };
    await this.tokens.create(record);
    return { token: present(record), secret };
  }
}

export class ListPersonalTokens {
  constructor(
    private readonly tokens: PersonalTokenRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string): Promise<PersonalTokenDto[]> {
    return (await this.tokens.listActive(userId, this.clock.now())).map(present);
  }
}

export class RevokePersonalToken {
  constructor(
    private readonly tokens: PersonalTokenRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, tokenId: string): Promise<void> {
    if (!(await this.tokens.revoke(tokenId, userId, this.clock.now()))) {
      throw new NotFoundError('Token');
    }
  }
}

export class AuthenticatePersonalToken {
  constructor(
    private readonly tokens: PersonalTokenRepository,
    private readonly generator: SecureTokenGenerator,
    private readonly clock: Clock,
  ) {}

  /** Resolves to the owner's user id, or null for unknown, revoked or expired tokens. */
  async execute(secret: string): Promise<string | null> {
    if (!secret.startsWith(PERSONAL_TOKEN_PREFIX)) return null;
    const record = await this.tokens.findByHash(this.generator.hash(secret));
    const now = this.clock.now();
    if (!record || record.revokedAt || record.expiresAt <= now) return null;
    if (
      !record.lastUsedAt ||
      now.getTime() - record.lastUsedAt.getTime() > LAST_USED_GRANULARITY_MS
    ) {
      await this.tokens.touch(record.id, now);
    }
    return record.userId;
  }
}
