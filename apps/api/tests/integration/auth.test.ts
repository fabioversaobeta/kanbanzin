import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { users } from '../../src/infrastructure/database/schema';
import {
  authHeader,
  createTestContext,
  readRefreshCookie,
  registerUser,
  STRONG_PASSWORD,
  uniqueEmail,
  WEB_ORIGIN,
  type TestContext,
} from '../helpers/test-app';

describe('authentication (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });

  describe('registration', () => {
    it('creates an account, returns an access token and sets a hardened refresh cookie', async () => {
      const email = uniqueEmail('new');
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: {
          name: 'Ada Lovelace',
          email: email.toUpperCase(),
          password: STRONG_PASSWORD,
          acceptTerms: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.user).toMatchObject({ name: 'Ada Lovelace', email });
      expect(body.user.passwordHash).toBeUndefined();
      expect(body.accessToken).toEqual(expect.any(String));

      const cookie = response.cookies.find((c) => c.name === 'kz_refresh');
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/v1/auth' });
    });

    it('never stores the password in clear text', async () => {
      const user = await registerUser(ctx.app);
      const [row] = await ctx.db.select().from(users).where(eq(users.id, user.userId));
      expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(row?.passwordHash).not.toContain(user.password);
    });

    it('records the consent to the terms (LGPD)', async () => {
      const user = await registerUser(ctx.app);
      const [row] = await ctx.db.select().from(users).where(eq(users.id, user.userId));
      expect(row?.termsVersion).toBeTruthy();
      expect(row?.termsAcceptedAt).toBeInstanceOf(Date);
    });

    it('rejects registration without accepting the terms', async () => {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { name: 'A', email: uniqueEmail(), password: STRONG_PASSWORD, acceptTerms: false },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('terms_not_accepted');
    });

    it('rejects weak passwords', async () => {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { name: 'A', email: uniqueEmail(), password: 'short', acceptTerms: true },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('weak_password');
    });

    it('rejects a duplicated e-mail', async () => {
      const first = await registerUser(ctx.app);
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { name: 'Dup', email: first.email, password: STRONG_PASSWORD, acceptTerms: true },
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('email_taken');
    });

    it('rejects malformed payloads with a 400', async () => {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/register',
        payload: { email: 123 },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('invalid_request');
    });
  });

  describe('login', () => {
    it('logs in with valid credentials', async () => {
      const user = await registerUser(ctx.app);
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: user.email, password: user.password },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().accessToken).toEqual(expect.any(String));
    });

    it('answers identically for unknown e-mails and wrong passwords', async () => {
      const user = await registerUser(ctx.app);
      const unknown = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: uniqueEmail('ghost'), password: 'whatever-password' },
      });
      const wrong = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: user.email, password: 'wrong-password-123' },
      });
      expect(unknown.statusCode).toBe(401);
      expect(wrong.statusCode).toBe(401);
      expect(unknown.json()).toEqual(wrong.json());
    });

    it('locks the account after repeated failures, even with the right password', async () => {
      const user = await registerUser(ctx.app);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await ctx.app.inject({
          method: 'POST',
          url: '/v1/auth/login',
          payload: { email: user.email, password: 'wrong-password-123' },
        });
      }
      const locked = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: user.email, password: user.password },
      });
      expect(locked.statusCode).toBe(429);
      expect(locked.json().error.code).toBe('account_locked');
    });
  });

  describe('sessions', () => {
    it('protects routes with a bearer token', async () => {
      const anonymous = await ctx.app.inject({ method: 'GET', url: '/v1/me' });
      expect(anonymous.statusCode).toBe(401);

      const forged = await ctx.app.inject({
        method: 'GET',
        url: '/v1/me',
        headers: { authorization: 'Bearer not-a-real-token' },
      });
      expect(forged.statusCode).toBe(401);

      const user = await registerUser(ctx.app);
      const ok = await ctx.app.inject({ method: 'GET', url: '/v1/me', headers: authHeader(user) });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().user.email).toBe(user.email);
    });

    it('rotates the refresh token and rejects the previous one', async () => {
      const user = await registerUser(ctx.app);
      const first = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: { origin: WEB_ORIGIN },
        cookies: { kz_refresh: user.refreshCookie },
      });
      expect(first.statusCode).toBe(200);
      const rotated = readRefreshCookie(first);
      expect(rotated).not.toBe(user.refreshCookie);
      expect(first.json().accessToken).toEqual(expect.any(String));

      const next = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: { origin: WEB_ORIGIN },
        cookies: { kz_refresh: rotated },
      });
      expect(next.statusCode).toBe(200);
    });

    it('revokes the whole session family when a rotated token is replayed', async () => {
      const clockless = await createTestContext({ clock: advancingClock() });
      try {
        const user = await registerUser(clockless.app);
        const first = await clockless.app.inject({
          method: 'POST',
          url: '/v1/auth/refresh',
          headers: { origin: WEB_ORIGIN },
          cookies: { kz_refresh: user.refreshCookie },
        });
        const rotated = readRefreshCookie(first);

        // Replaying the old token (outside the concurrency grace window) is treated as theft.
        const replay = await clockless.app.inject({
          method: 'POST',
          url: '/v1/auth/refresh',
          headers: { origin: WEB_ORIGIN },
          cookies: { kz_refresh: user.refreshCookie },
        });
        expect(replay.statusCode).toBe(401);

        const afterReplay = await clockless.app.inject({
          method: 'POST',
          url: '/v1/auth/refresh',
          headers: { origin: WEB_ORIGIN },
          cookies: { kz_refresh: rotated },
        });
        expect(afterReplay.statusCode).toBe(401);
      } finally {
        await clockless.close();
      }
    });

    it('refuses to refresh without the cookie', async () => {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: { origin: WEB_ORIGIN },
      });
      expect(response.statusCode).toBe(401);
    });

    it('logs out by revoking the refresh token', async () => {
      const user = await registerUser(ctx.app);
      const logout = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/logout',
        headers: { origin: WEB_ORIGIN },
        cookies: { kz_refresh: user.refreshCookie },
      });
      expect(logout.statusCode).toBe(204);

      const refresh = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: { origin: WEB_ORIGIN },
        cookies: { kz_refresh: user.refreshCookie },
      });
      expect(refresh.statusCode).toBe(401);
    });
  });

  describe('CSRF protection', () => {
    it('rejects cookie-authenticated requests from foreign origins', async () => {
      const user = await registerUser(ctx.app);
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: { origin: 'https://evil.example' },
        cookies: { kz_refresh: user.refreshCookie },
      });
      expect(response.statusCode).toBe(403);
    });

    it('rejects cookie-authenticated requests without an Origin header', async () => {
      const user = await registerUser(ctx.app);
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        cookies: { kz_refresh: user.refreshCookie },
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('password recovery', () => {
    it('emails a single-use link and lets the user set a new password', async () => {
      const user = await registerUser(ctx.app);
      const forgot = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/password/forgot',
        payload: { email: user.email },
      });
      expect(forgot.statusCode).toBe(202);
      expect(ctx.mailer.sent.at(-1)?.to).toBe(user.email);
      expect(ctx.mailer.sent.at(-1)?.resetUrl).toContain(`${WEB_ORIGIN}/reset-password#token=`);

      const token = ctx.mailer.lastResetToken();
      const newPassword = 'a-brand-new-passphrase';
      const reset = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/password/reset',
        payload: { token, password: newPassword },
      });
      expect(reset.statusCode).toBe(204);

      const oldLogin = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: user.email, password: user.password },
      });
      expect(oldLogin.statusCode).toBe(401);
      const newLogin = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: user.email, password: newPassword },
      });
      expect(newLogin.statusCode).toBe(200);

      const reuse = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/password/reset',
        payload: { token, password: 'yet-another-passphrase' },
      });
      expect(reuse.statusCode).toBe(400);
      expect(reuse.json().error.code).toBe('invalid_reset_token');
    });

    it('signs out every existing session after a reset', async () => {
      const user = await registerUser(ctx.app);
      await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/password/forgot',
        payload: { email: user.email },
      });
      await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/password/reset',
        payload: { token: ctx.mailer.lastResetToken(), password: 'a-brand-new-passphrase' },
      });
      const refresh = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: { origin: WEB_ORIGIN },
        cookies: { kz_refresh: user.refreshCookie },
      });
      expect(refresh.statusCode).toBe(401);
    });

    it('does not reveal whether an e-mail is registered', async () => {
      const before = ctx.mailer.sent.length;
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/password/forgot',
        payload: { email: uniqueEmail('ghost') },
      });
      expect(response.statusCode).toBe(202);
      expect(ctx.mailer.sent.length).toBe(before);
    });

    it('rejects invalid tokens', async () => {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/password/reset',
        payload: { token: 'nope', password: STRONG_PASSWORD },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('invalid_reset_token');
    });
  });

  describe('account and privacy (LGPD)', () => {
    it('updates the profile name', async () => {
      const user = await registerUser(ctx.app);
      const response = await ctx.app.inject({
        method: 'PATCH',
        url: '/v1/me',
        headers: authHeader(user),
        payload: { name: '  Grace   Hopper ' },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().user.name).toBe('Grace Hopper');
    });

    it('changes the password and signs other sessions out', async () => {
      const user = await registerUser(ctx.app);
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/me/password',
        headers: authHeader(user),
        payload: { currentPassword: user.password, newPassword: 'another-strong-passphrase' },
      });
      expect(response.statusCode).toBe(200);

      const stale = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: { origin: WEB_ORIGIN },
        cookies: { kz_refresh: user.refreshCookie },
      });
      expect(stale.statusCode).toBe(401);
    });

    it('requires the current password to change it', async () => {
      const user = await registerUser(ctx.app);
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/me/password',
        headers: authHeader(user),
        payload: { currentPassword: 'not-the-password', newPassword: 'another-strong-passphrase' },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('wrong_password');
    });

    it('exports all personal data as JSON without secrets', async () => {
      const user = await registerUser(ctx.app);
      const board = await ctx.app.inject({
        method: 'POST',
        url: '/v1/boards',
        headers: authHeader(user),
        payload: { title: 'My board' },
      });
      expect(board.statusCode).toBe(201);

      const response = await ctx.app.inject({
        method: 'GET',
        url: '/v1/me/export',
        headers: authHeader(user),
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-disposition']).toContain('attachment');
      const data = response.json();
      expect(data.account.email).toBe(user.email);
      expect(data.boards).toHaveLength(1);
      expect(JSON.stringify(data)).not.toMatch(/argon2|passwordHash/);
    });

    it('erases the account and all of its data on request', async () => {
      const user = await registerUser(ctx.app);
      await ctx.app.inject({
        method: 'POST',
        url: '/v1/boards',
        headers: authHeader(user),
        payload: { title: 'To be erased' },
      });

      const wrong = await ctx.app.inject({
        method: 'DELETE',
        url: '/v1/me',
        headers: authHeader(user),
        payload: { password: 'incorrect-password' },
      });
      expect(wrong.statusCode).toBe(401);

      const response = await ctx.app.inject({
        method: 'DELETE',
        url: '/v1/me',
        headers: authHeader(user),
        payload: { password: user.password },
      });
      expect(response.statusCode).toBe(204);

      const login = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: user.email, password: user.password },
      });
      expect(login.statusCode).toBe(401);
      const [remaining] = await ctx.db.select().from(users).where(eq(users.id, user.userId));
      expect(remaining).toBeUndefined();
    });
  });
});

/** A clock that moves forward 1 minute on each read, so grace windows elapse between calls. */
function advancingClock() {
  let current = Date.now();
  return {
    now: () => {
      current += 60_000;
      return new Date(current);
    },
  };
}
