import { beforeEach, describe, expect, it } from 'vitest';
import { LoginUser } from '../../src/modules/identity/application/login-user';
import {
  RequestPasswordReset,
  ResetPassword,
} from '../../src/modules/identity/application/password-reset';
import { RefreshSession } from '../../src/modules/identity/application/refresh-session';
import { RegisterUser } from '../../src/modules/identity/application/register-user';
import { SessionIssuer } from '../../src/modules/identity/application/session-issuer';
import { noopLogger } from '../../src/shared/logger';
import {
  FakeAccessTokens,
  FakeHasher,
  InMemoryPasswordResets,
  InMemoryRefreshTokens,
  InMemoryUsers,
  MutableClock,
  RecordingMailer,
  SequentialTokenGenerator,
} from './fakes';

function setup() {
  const clock = new MutableClock();
  const users = new InMemoryUsers();
  const refreshTokens = new InMemoryRefreshTokens();
  const resets = new InMemoryPasswordResets();
  const hasher = new FakeHasher();
  const generator = new SequentialTokenGenerator();
  const mailer = new RecordingMailer();
  const sessions = new SessionIssuer(refreshTokens, new FakeAccessTokens(), generator, clock);
  return {
    clock,
    users,
    refreshTokens,
    resets,
    mailer,
    register: new RegisterUser(users, hasher, sessions, clock),
    login: new LoginUser(users, hasher, sessions, clock),
    refresh: new RefreshSession(users, refreshTokens, generator, sessions, clock),
    requestReset: new RequestPasswordReset(
      users,
      resets,
      generator,
      mailer,
      clock,
      noopLogger,
      'https://app.test',
    ),
    reset: new ResetPassword(users, resets, refreshTokens, generator, hasher, clock),
  };
}

const credentials = { name: 'Ada', email: 'ada@example.com', password: 'correct-horse-battery' };

describe('RegisterUser', () => {
  it('creates a user, records consent and opens a session', async () => {
    const { register, users } = setup();
    const result = await register.execute({ ...credentials, acceptTerms: true });

    expect(result.user.email).toBe('ada@example.com');
    expect(result.session.accessToken).toBe(`access:${result.user.id}`);
    const stored = users.items.get(result.user.id)!;
    expect(stored.passwordHash).not.toBe(credentials.password);
    expect(stored.termsAcceptedAt).toEqual(new Date('2026-01-01T12:00:00Z'));
  });

  it('refuses duplicates (case-insensitively) and missing consent', async () => {
    const { register } = setup();
    await register.execute({ ...credentials, acceptTerms: true });
    await expect(
      register.execute({ ...credentials, email: 'ADA@example.com', acceptTerms: true }),
    ).rejects.toMatchObject({ code: 'email_taken' });
    await expect(
      register.execute({ ...credentials, email: 'new@example.com', acceptTerms: false }),
    ).rejects.toMatchObject({ code: 'terms_not_accepted' });
  });
});

describe('LoginUser', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(async () => {
    ctx = setup();
    await ctx.register.execute({ ...credentials, acceptTerms: true });
  });

  it('locks for 15 minutes after 5 failures and unlocks afterwards', async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(
        ctx.login.execute({ email: credentials.email, password: 'wrong-password' }),
      ).rejects.toMatchObject({ code: 'invalid_credentials' });
    }
    await expect(ctx.login.execute(credentials)).rejects.toMatchObject({ code: 'account_locked' });

    ctx.clock.advance(15 * 60_000 + 1);
    await expect(ctx.login.execute(credentials)).resolves.toBeDefined();
  });

  it('resets the failure counter after a successful login', async () => {
    await expect(
      ctx.login.execute({ email: credentials.email, password: 'wrong-password' }),
    ).rejects.toBeDefined();
    await ctx.login.execute(credentials);
    const user = await ctx.users.findByEmail(credentials.email);
    expect(user?.failedLoginCount).toBe(0);
  });
});

describe('RefreshSession', () => {
  it('rotates tokens within the same family', async () => {
    const { register, refresh, refreshTokens } = setup();
    const { session } = await register.execute({ ...credentials, acceptTerms: true });
    const next = await refresh.execute(session.refreshToken);

    expect(next.session.refreshToken).not.toBe(session.refreshToken);
    expect(new Set(refreshTokens.items.map((t) => t.familyId)).size).toBe(1);
  });

  it('tolerates a concurrent rotation but revokes the family on a late replay', async () => {
    const { register, refresh, refreshTokens, clock } = setup();
    const { session } = await register.execute({ ...credentials, acceptTerms: true });
    const rotated = await refresh.execute(session.refreshToken);

    // Immediate replay (two tabs): rejected, but the new token keeps working.
    await expect(refresh.execute(session.refreshToken)).rejects.toMatchObject({
      code: 'invalid_session',
    });
    expect(refreshTokens.items.find((t) => !t.revokedAt)).toBeDefined();

    // Late replay: treated as theft, every token of the family is revoked.
    clock.advance(60_000);
    await expect(refresh.execute(session.refreshToken)).rejects.toMatchObject({
      code: 'invalid_session',
    });
    await expect(refresh.execute(rotated.session.refreshToken)).rejects.toMatchObject({
      code: 'invalid_session',
    });
  });

  it('rejects expired refresh tokens', async () => {
    const { register, refresh, clock } = setup();
    const { session } = await register.execute({ ...credentials, acceptTerms: true });
    clock.advance(31 * 86_400_000);
    await expect(refresh.execute(session.refreshToken)).rejects.toMatchObject({
      code: 'invalid_session',
    });
  });
});

describe('password reset', () => {
  it('stores only a hash of the token and links through the URL fragment', async () => {
    const { register, requestReset, resets, mailer } = setup();
    await register.execute({ ...credentials, acceptTerms: true });
    await requestReset.execute(credentials.email);

    const email = mailer.sent[0]!;
    const token = email.resetUrl.split('#token=')[1]!;
    expect(email.resetUrl.startsWith('https://app.test/reset-password#')).toBe(true);
    expect(resets.items[0]!.tokenHash).not.toContain(token);
    expect(email.expiresInMinutes).toBe(60);
  });

  it('invalidates previous links when a new one is requested', async () => {
    const { register, requestReset, reset, mailer } = setup();
    await register.execute({ ...credentials, acceptTerms: true });
    await requestReset.execute(credentials.email);
    await requestReset.execute(credentials.email);

    const [first, second] = mailer.sent.map((m) => m.resetUrl.split('#token=')[1]!);
    await expect(
      reset.execute({ token: first!, newPassword: 'brand-new-passphrase' }),
    ).rejects.toMatchObject({
      code: 'invalid_reset_token',
    });
    await expect(
      reset.execute({ token: second!, newPassword: 'brand-new-passphrase' }),
    ).resolves.toBeUndefined();
  });

  it('expires after one hour', async () => {
    const { register, requestReset, reset, mailer, clock } = setup();
    await register.execute({ ...credentials, acceptTerms: true });
    await requestReset.execute(credentials.email);
    clock.advance(61 * 60_000);
    const token = mailer.sent[0]!.resetUrl.split('#token=')[1]!;
    await expect(
      reset.execute({ token, newPassword: 'brand-new-passphrase' }),
    ).rejects.toMatchObject({
      code: 'invalid_reset_token',
    });
  });

  it('enforces the password policy on the new password', async () => {
    const { register, requestReset, reset, mailer } = setup();
    await register.execute({ ...credentials, acceptTerms: true });
    await requestReset.execute(credentials.email);
    const token = mailer.sent[0]!.resetUrl.split('#token=')[1]!;
    await expect(reset.execute({ token, newPassword: 'short' })).rejects.toMatchObject({
      code: 'weak_password',
    });
  });

  it('silently ignores unknown and invalid e-mails', async () => {
    const { requestReset, mailer } = setup();
    await expect(requestReset.execute('nobody@example.com')).resolves.toBeUndefined();
    await expect(requestReset.execute('not-an-email')).resolves.toBeUndefined();
    expect(mailer.sent).toHaveLength(0);
  });
});
