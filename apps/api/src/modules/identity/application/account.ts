import type { Clock } from '../../../shared/clock';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../../shared/errors';
import { assertStrongPassword } from '../domain/password-policy';
import { normalizeName, toProfile, type User, type UserProfile } from '../domain/user';
import type { PasswordHasher, RefreshTokenRepository, UserRepository } from './ports';
import type { SessionIssuer, SessionTokens } from './session-issuer';

async function requireUser(users: UserRepository, id: string): Promise<User> {
  const user = await users.findById(id);
  if (!user) throw new NotFoundError('User');
  return user;
}

export class GetCurrentUser {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<UserProfile> {
    return toProfile(await requireUser(this.users, userId));
  }
}

export class UpdateProfile {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: Clock,
  ) {}

  async execute(userId: string, input: { name: string }): Promise<UserProfile> {
    const user = await requireUser(this.users, userId);
    const name = normalizeName(input.name);
    await this.users.updateName(user.id, name, this.clock.now());
    return toProfile({ ...user, name });
  }
}

export class ChangePassword {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
    private readonly clock: Clock,
  ) {}

  /** Signs every other device out and returns a fresh session for the caller. */
  async execute(
    userId: string,
    input: { currentPassword: string; newPassword: string },
  ): Promise<SessionTokens> {
    const user = await requireUser(this.users, userId);
    if (!(await this.hasher.verify(user.passwordHash, input.currentPassword))) {
      throw new ValidationError('wrong_password', 'The current password is incorrect.');
    }
    assertStrongPassword(input.newPassword, { email: user.email, name: user.name });

    const now = this.clock.now();
    await this.users.updatePasswordHash(user.id, await this.hasher.hash(input.newPassword), now);
    await this.refreshTokens.revokeAllForUser(user.id, now);
    return this.sessions.issue(user.id);
  }
}

/** LGPD art. 18, VI: erasure of personal data at the data subject's request. */
export class DeleteAccount {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(userId: string, input: { password: string }): Promise<void> {
    const user = await requireUser(this.users, userId);
    if (!(await this.hasher.verify(user.passwordHash, input.password))) {
      throw new UnauthorizedError('wrong_password', 'The password is incorrect.');
    }
    // Foreign keys cascade to sessions, reset tokens, boards, lists, cards and superpowers.
    await this.users.delete(user.id);
  }
}
