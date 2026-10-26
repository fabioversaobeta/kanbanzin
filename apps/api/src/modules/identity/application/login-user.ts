import type { Clock } from '../../../shared/clock';
import { RateLimitedError, UnauthorizedError } from '../../../shared/errors';
import { isLocked, LOCKOUT_MINUTES, MAX_FAILED_LOGINS, toProfile } from '../domain/user';
import { normalizeEmail } from '../domain/email';
import type { PasswordHasher, UserRepository } from './ports';
import type { AuthResult } from './register-user';
import type { SessionIssuer } from './session-issuer';

const INVALID_CREDENTIALS = 'Invalid e-mail or password.';

export class LoginUser {
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
    private readonly clock: Clock,
  ) {}

  async execute(input: { email: string; password: string }): Promise<AuthResult> {
    let email: string;
    try {
      email = normalizeEmail(input.email);
    } catch {
      throw new UnauthorizedError('invalid_credentials', INVALID_CREDENTIALS);
    }

    const user = await this.users.findByEmail(email);
    if (!user) {
      // Spend the same CPU time as a real verification to avoid revealing which e-mails exist.
      await this.hasher.verify(await this.getDummyHash(), input.password);
      throw new UnauthorizedError('invalid_credentials', INVALID_CREDENTIALS);
    }

    const now = this.clock.now();
    if (isLocked(user, now)) {
      throw new RateLimitedError(
        'account_locked',
        'Too many failed attempts. Try again in a few minutes.',
      );
    }

    if (!(await this.hasher.verify(user.passwordHash, input.password))) {
      await this.registerFailure(user.id, user.failedLoginCount + 1, now);
      throw new UnauthorizedError('invalid_credentials', INVALID_CREDENTIALS);
    }

    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await this.users.clearLoginFailures(user.id);
    }
    return { user: toProfile(user), session: await this.sessions.issue(user.id) };
  }

  private async registerFailure(userId: string, failures: number, now: Date): Promise<void> {
    if (failures >= MAX_FAILED_LOGINS) {
      const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
      await this.users.recordLoginFailure(userId, 0, lockedUntil);
      return;
    }
    await this.users.recordLoginFailure(userId, failures, null);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.hasher.hash('kanbanzin-dummy-password');
    return this.dummyHash;
  }
}
