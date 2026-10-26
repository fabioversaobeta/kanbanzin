import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { Container } from '../../container';
import type { SessionTokens } from '../../modules/identity/application/session-issuer';
import { createAuthenticate } from './auth-guard';

export const REFRESH_COOKIE = 'kz_refresh';
const REFRESH_COOKIE_PATH = '/v1/auth';

const registerBody = z.object({
  name: z.string().max(200),
  email: z.string().max(320),
  password: z.string().max(1024),
  acceptTerms: z.boolean(),
});
const loginBody = z.object({ email: z.string().max(320), password: z.string().max(1024) });
const forgotBody = z.object({ email: z.string().max(320) });
const resetBody = z.object({ token: z.string().min(1).max(200), password: z.string().max(1024) });
const profileBody = z.object({ name: z.string().max(200) });
const changePasswordBody = z.object({
  currentPassword: z.string().max(1024),
  newPassword: z.string().max(1024),
});
const deleteAccountBody = z.object({ password: z.string().max(1024) });

interface AuthRoutesOptions {
  container: Container;
  secureCookies: boolean;
  limits: { login: number; register: number; passwordReset: number; refresh: number };
}

export function registerAuthRoutes(app: FastifyInstance, options: AuthRoutesOptions): void {
  const { container, secureCookies, limits } = options;
  const authenticate = createAuthenticate(container);

  const writeSession = (reply: FastifyReply, session: SessionTokens) => {
    reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: secureCookies,
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      expires: session.refreshTokenExpiresAt,
    });
    reply.header('Cache-Control', 'no-store');
    return { accessToken: session.accessToken, expiresIn: session.accessTokenExpiresInSeconds };
  };

  app.post(
    '/v1/auth/register',
    { config: { rateLimit: { max: limits.register, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const body = registerBody.parse(request.body);
      const { user, session } = await container.identity.register.execute(body);
      return reply.status(201).send({ user, ...writeSession(reply, session) });
    },
  );

  app.post(
    '/v1/auth/login',
    { config: { rateLimit: { max: limits.login, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = loginBody.parse(request.body);
      const { user, session } = await container.identity.login.execute(body);
      return reply.send({ user, ...writeSession(reply, session) });
    },
  );

  app.post(
    '/v1/auth/refresh',
    { config: { rateLimit: { max: limits.refresh, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const token = request.cookies[REFRESH_COOKIE];
      if (!token) {
        reply.status(401);
        return { error: { code: 'invalid_session', message: 'Session expired.' } };
      }
      try {
        const { user, session } = await container.identity.refresh.execute(token);
        return reply.send({ user, ...writeSession(reply, session) });
      } catch (error) {
        reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
        throw error;
      }
    },
  );

  app.post('/v1/auth/logout', async (request, reply) => {
    await container.identity.logout.execute(request.cookies[REFRESH_COOKIE]);
    reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
    return reply.status(204).send();
  });

  app.post(
    '/v1/auth/password/forgot',
    { config: { rateLimit: { max: limits.passwordReset, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const body = forgotBody.parse(request.body);
      await container.identity.requestPasswordReset.execute(body.email);
      // Same answer whether or not the account exists.
      return reply.status(202).send({
        message: 'If the e-mail is registered, you will receive instructions shortly.',
      });
    },
  );

  app.post(
    '/v1/auth/password/reset',
    { config: { rateLimit: { max: limits.passwordReset, timeWindow: '1 hour' } } },
    async (request, reply) => {
      const body = resetBody.parse(request.body);
      await container.identity.resetPassword.execute({
        token: body.token,
        newPassword: body.password,
      });
      return reply.status(204).send();
    },
  );

  app.get('/v1/me', { preHandler: authenticate }, async (request) => ({
    user: await container.identity.currentUser.execute(request.userId),
  }));

  app.patch('/v1/me', { preHandler: authenticate }, async (request) => {
    const body = profileBody.parse(request.body);
    return { user: await container.identity.updateProfile.execute(request.userId, body) };
  });

  app.post(
    '/v1/me/password',
    {
      preHandler: authenticate,
      config: { rateLimit: { max: limits.passwordReset, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const body = changePasswordBody.parse(request.body);
      const session = await container.identity.changePassword.execute(request.userId, body);
      return reply.send(writeSession(reply, session));
    },
  );

  app.get('/v1/me/export', { preHandler: authenticate }, async (request, reply) => {
    const data = await container.privacy.exportData.execute(request.userId);
    reply.header('Content-Disposition', 'attachment; filename="kanbanzin-data.json"');
    reply.header('Cache-Control', 'no-store');
    return data;
  });

  app.delete(
    '/v1/me',
    {
      preHandler: authenticate,
      config: { rateLimit: { max: limits.passwordReset, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const body = deleteAccountBody.parse(request.body);
      await container.identity.deleteAccount.execute(request.userId, body);
      reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      return reply.status(204).send();
    },
  );
}
