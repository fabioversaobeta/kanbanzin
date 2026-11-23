import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MutableClock } from '../unit/fakes';
import {
  authHeader,
  createTestContext,
  registerUser,
  type RegisteredUser,
  type TestContext,
} from '../helpers/test-app';

describe('personal access tokens (integration)', () => {
  const clock = new MutableClock();
  let ctx: TestContext;
  let user: RegisteredUser;

  async function createToken(body: Record<string, unknown> = { name: 'Claude Code' }) {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/v1/me/tokens',
      headers: authHeader(user),
      payload: body,
    });
    return response;
  }

  beforeAll(async () => {
    ctx = await createTestContext({ clock });
    user = await registerUser(ctx.app);
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('issues a token once, lists it without the secret and authenticates board routes', async () => {
    const created = await createToken();
    expect(created.statusCode).toBe(201);
    const { token, secret } = created.json<{
      token: { id: string; prefix: string };
      secret: string;
    }>();
    expect(secret.startsWith('kbz_')).toBe(true);
    expect(secret.startsWith(token.prefix)).toBe(true);

    const listed = await ctx.app.inject({
      method: 'GET',
      url: '/v1/me/tokens',
      headers: authHeader(user),
    });
    expect(listed.body).not.toContain(secret);
    expect(listed.json<{ tokens: unknown[] }>().tokens).toHaveLength(1);

    const boards = await ctx.app.inject({
      method: 'GET',
      url: '/v1/boards',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(boards.statusCode).toBe(200);
  });

  it('refuses personal tokens on account management routes', async () => {
    const { secret } = (await createToken({ name: 'Second' })).json<{ secret: string }>();
    const headers = { authorization: `Bearer ${secret}` };
    expect((await ctx.app.inject({ method: 'GET', url: '/v1/me', headers })).statusCode).toBe(401);
    expect(
      (
        await ctx.app.inject({
          method: 'POST',
          url: '/v1/me/tokens',
          headers,
          payload: { name: 'x' },
        })
      ).statusCode,
    ).toBe(401);
  });

  it('rejects revoked, expired and forged tokens', async () => {
    const created = (await createToken({ name: 'Short', expiresInDays: 1 })).json<{
      token: { id: string };
      secret: string;
    }>();
    const call = (secret: string) =>
      ctx.app.inject({
        method: 'GET',
        url: '/v1/boards',
        headers: { authorization: `Bearer ${secret}` },
      });

    expect((await call(`${created.secret}x`)).statusCode).toBe(401);
    expect((await call('kbz_unknown')).statusCode).toBe(401);

    const revoked = (await createToken({ name: 'To revoke' })).json<{
      token: { id: string };
      secret: string;
    }>();
    const revoke = await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/me/tokens/${revoked.token.id}`,
      headers: authHeader(user),
    });
    expect(revoke.statusCode).toBe(204);
    expect((await call(revoked.secret)).statusCode).toBe(401);

    expect((await call(created.secret)).statusCode).toBe(200);
    clock.advance(2 * 24 * 60 * 60 * 1000);
    expect((await call(created.secret)).statusCode).toBe(401);
  });

  it("does not let users revoke someone else's token", async () => {
    const other = await registerUser(ctx.app);
    const mine = (await createToken({ name: 'Mine' })).json<{ token: { id: string } }>();
    const response = await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/me/tokens/${mine.token.id}`,
      headers: authHeader(other),
    });
    expect(response.statusCode).toBe(404);
  });

  it('validates the name and expiry', async () => {
    expect((await createToken({ name: '   ' })).statusCode).toBe(400);
    expect((await createToken({ name: 'ok', expiresInDays: 0 })).statusCode).toBe(400);
    expect((await createToken({ name: 'ok', expiresInDays: 366 })).statusCode).toBe(400);
  });
});
