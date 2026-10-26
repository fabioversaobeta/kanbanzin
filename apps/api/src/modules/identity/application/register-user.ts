import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock';
import { ConflictError, ValidationError } from '../../../shared/errors';
import { normalizeEmail } from '../domain/email';
import { assertStrongPassword } from '../domain/password-policy';
import { CURRENT_TERMS_VERSION, normalizeName, toProfile, type UserProfile } from '../domain/user';
import type { PasswordHasher, UserRepository } from './ports';
import type { SessionIssuer, SessionTokens } from './session-issuer';

export interface RegisterUserInput {
  name: string;
  email: string;
  password: string;
  acceptTerms: boolean;
}

export interface AuthResult {
  user: UserProfile;
  session: SessionTokens;
}

export class RegisterUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionIssuer,
    private readonly clock: Clock,
  ) {}

  async execute(input: RegisterUserInput): Promise<AuthResult> {
    if (!input.acceptTerms) {
      throw new ValidationError(
        'terms_not_accepted',
        'You must accept the Terms of Use and the Privacy Policy.',
      );
    }
    const email = normalizeEmail(input.email);
    const name = normalizeName(input.name);
    assertStrongPassword(input.password, { email, name });

    if (await this.users.findByEmail(email)) {
      throw new ConflictError('email_taken', 'This e-mail is already registered.');
    }

    const now = this.clock.now();
    const user = {
      id: randomUUID(),
      email,
      name,
      passwordHash: await this.hasher.hash(input.password),
      termsVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: now,
      failedLoginCount: 0,
      lockedUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    await this.users.create(user);

    return { user: toProfile(user), session: await this.sessions.issue(user.id) };
  }
}
