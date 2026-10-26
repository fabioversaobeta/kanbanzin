import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createTestContext,
  STRONG_PASSWORD,
  uniqueEmail,
  WEB_ORIGIN,
  type TestContext,
} from '../helpers/test-app';

describe('HTTP security (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('exposes liveness and readiness probes', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/health' })).json()).toEqual({
      status: 'ok',
    });
    expect((await ctx.app.inject({ method: 'GET', url: '/health/ready' })).json()).toEqual({
      status: 'ready',
    });
  });

  it('sends hardened security headers and never caches API responses', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/v1/me' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['strict-transport-security']).toContain('max-age=');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
    expect(response.headers['referrer-policy']).toBe('no-referrer');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('only allows the configured web origin through CORS', async () => {
    const allowed = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/v1/auth/login',
      headers: { origin: WEB_ORIGIN, 'access-control-request-method': 'POST' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await ctx.app.inject({
      method: 'OPTIONS',
      url: '/v1/auth/login',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('blocks unsafe requests from foreign browsers origins', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { origin: 'https://evil.example' },
      payload: { email: uniqueEmail(), password: STRONG_PASSWORD },
    });
    expect(response.statusCode).toBe(403);
  });

  it('does not leak internals in error responses', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/v1/unknown' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: { code: 'not_found', message: 'Route not found.' } });

    const malformed = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{"email": ',
    });
    expect(malformed.statusCode).toBe(400);
    expect(malformed.body).not.toMatch(/at .*\.(ts|js)/);
  });

  it('rejects oversized bodies', async () => {
    const response = await ctx.app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'a@b.co', password: 'x'.repeat(200 * 1024) },
    });
    expect(response.statusCode).toBe(413);
  });
});

describe('rate limiting (integration)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext({ rateLimits: { login: 3, global: 1000 } });
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('throttles repeated login attempts per client', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const response = await ctx.app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: uniqueEmail(), password: STRONG_PASSWORD },
      });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 3)).toEqual([401, 401, 401]);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });
});
