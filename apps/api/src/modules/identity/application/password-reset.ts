import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock';
import { ValidationError } from '../../../shared/errors';
import type { Logger } from '../../../shared/logger';
import { normalizeEmail } from '../domain/email';
import { assertStrongPassword } from '../domain/password-policy';
import type {
  Mailer,
  PasswordHasher,
  PasswordResetRepository,
  RefreshTokenRepository,
  SecureTokenGenerator,
  UserRepository,
} from './ports';

export const PASSWORD_RESET_TTL_MINUTES = 60;

export class RequestPasswordReset {
  constructor(
    private readonly users: UserRepository,
    private readonly resets: PasswordResetRepository,
    private readonly generator: SecureTokenGenerator,
    private readonly mailer: Mailer,
    private readonly clock: Clock,
    private readonly logger: Logger,
    /** Base URL of the web app used to build the link sent by e-mail. */
    private readonly webBaseUrl: string,
  ) {}

  /**
   * Never reveals whether the e-mail exists: callers always get the same outcome.
   * The e-mail is sent in the background so response time does not leak account existence.
   */
  async execute(rawEmail: string): Promise<void> {
    let email: string;
    try {
      email = normalizeEmail(rawEmail);
    } catch {
      return;
    }
    const user = await this.users.findByEmail(email);
    if (!user) return;

    const now = this.clock.now();
    await this.resets.invalidateAllForUser(user.id, now);
    const { token, hash } = this.generator.generate();
    await this.resets.create({
      id: randomUUID(),
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MINUTES * 60_000),
      usedAt: null,
    });

    // The token travels in the URL fragment so it is never sent to servers or leaked via Referer.
    const resetUrl = `${this.webBaseUrl}/reset-password#token=${token}`;
    this.mailer
      .sendPasswordReset({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: PASSWORD_RESET_TTL_MINUTES,
      })
      .catch((error: unknown) => {
        this.logger.error({ err: error, userId: user.id }, 'Failed to send password reset e-mail');
      });
  }
}

export class ResetPassword {
  constructor(
    private readonly users: UserRepository,
    private readonly resets: PasswordResetRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly generator: SecureTokenGenerator,
    private readonly hasher: PasswordHasher,
    private readonly clock: Clock,
  ) {}

  async execute(input: { token: string; newPassword: string }): Promise<void> {
    const now = this.clock.now();
    const record = await this.resets.findByHash(this.generator.hash(input.token));
    if (!record || record.usedAt || record.expiresAt.getTime() <= now.getTime()) {
      throw new ValidationError(
        'invalid_reset_token',
        'This reset link is invalid or has expired.',
      );
    }
    const user = await this.users.findById(record.userId);
    if (!user) {
      throw new ValidationError(
        'invalid_reset_token',
        'This reset link is invalid or has expired.',
      );
    }

    assertStrongPassword(input.newPassword, { email: user.email, name: user.name });

    if (!(await this.resets.markUsed(record.id, now))) {
      throw new ValidationError(
        'invalid_reset_token',
        'This reset link is invalid or has expired.',
      );
    }
    await this.users.updatePasswordHash(user.id, await this.hasher.hash(input.newPassword), now);
    await this.users.clearLoginFailures(user.id);
    // A password reset must sign the account out everywhere.
    await this.refreshTokens.revokeAllForUser(user.id, now);
  }
}
