import type { Clock } from '../../../shared/clock';
import { UnauthorizedError } from '../../../shared/errors';
import { toProfile } from '../domain/user';
import type { RefreshTokenRepository, SecureTokenGenerator, UserRepository } from './ports';
import type { AuthResult } from './register-user';
import type { SessionIssuer } from './session-issuer';

/** Two tabs may legitimately rotate the same token at nearly the same time. */
const CONCURRENT_ROTATION_GRACE_MS = 10_000;

export class RefreshSession {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly generator: SecureTokenGenerator,
    private readonly sessions: SessionIssuer,
    private readonly clock: Clock,
  ) {}

  /** Rotates the refresh token: the presented token is revoked and a new pair is issued. */
  async execute(refreshToken: string): Promise<AuthResult> {
    const now = this.clock.now();
    const record = await this.refreshTokens.findByHash(this.generator.hash(refreshToken));
    if (!record) throw new UnauthorizedError('invalid_session', 'Session expired.');

    if (record.revokedAt) {
      const justRotated = now.getTime() - record.revokedAt.getTime() < CONCURRENT_ROTATION_GRACE_MS;
      // Presenting a revoked token outside the grace window means it was stolen or replayed.
      if (!justRotated) await this.refreshTokens.revokeFamily(record.familyId, now);
      throw new UnauthorizedError('invalid_session', 'Session expired.');
    }
    if (record.expiresAt.getTime() <= now.getTime()) {
      throw new UnauthorizedError('invalid_session', 'Session expired.');
    }
    if (!(await this.refreshTokens.revoke(record.id, now))) {
      throw new UnauthorizedError('invalid_session', 'Session expired.');
    }

    const user = await this.users.findById(record.userId);
    if (!user) throw new UnauthorizedError('invalid_session', 'Session expired.');

    return { user: toProfile(user), session: await this.sessions.issue(user.id, record.familyId) };
  }
}
