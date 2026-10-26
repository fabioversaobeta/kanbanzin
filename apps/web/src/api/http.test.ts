import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, refreshSession, request, setAccessToken, setSessionLostHandler } from './http';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const session = (token: string) => ({
  accessToken: token,
  user: { id: '1', email: 'a@b.co', name: 'A', createdAt: '2026-01-01T00:00:00.000Z' },
});

describe('API client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    setAccessToken(null);
    setSessionLostHandler(null);
  });
  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('sends the bearer token and always includes credentials', async () => {
    setAccessToken('token-1');
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await expect(request('/v1/boards')).resolves.toEqual({ ok: true });

    const [, init] = fetchMock.mock.calls[0]!;
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
    expect(init?.credentials).toBe('include');
  });

  it('turns API errors into ApiError with the server code', async () => {
    fetchMock.mockResolvedValueOnce(
      json(409, { error: { code: 'email_taken', message: 'taken' } }),
    );

    await expect(request('/v1/auth/register', { auth: false })).rejects.toMatchObject({
      status: 409,
      code: 'email_taken',
    });
  });

  it('refreshes the session once on 401 and retries the original request', async () => {
    setAccessToken('expired');
    fetchMock
      .mockResolvedValueOnce(json(401, { error: { code: 'unauthorized', message: 'x' } }))
      .mockResolvedValueOnce(json(200, session('fresh')))
      .mockResolvedValueOnce(json(200, { boards: [] }));

    await expect(request('/v1/boards')).resolves.toEqual({ boards: [] });

    const [url, init] = fetchMock.mock.calls[2]!;
    expect(String(url)).toContain('/v1/boards');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
  });

  it('shares a single refresh request between concurrent callers', async () => {
    fetchMock.mockImplementation(async () => json(200, session('shared')));

    const results = await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.accessToken === 'shared')).toBe(true);
  });

  it('reports a lost session when the refresh fails', async () => {
    vi.useFakeTimers();
    const onLost = vi.fn();
    setSessionLostHandler(onLost);
    setAccessToken('expired');
    fetchMock.mockImplementation(async (input) =>
      String(input).includes('/refresh')
        ? json(401, { error: { code: 'invalid_session', message: 'x' } })
        : json(401, { error: { code: 'unauthorized', message: 'x' } }),
    );

    const pending = request('/v1/boards');
    const assertion = expect(pending).rejects.toBeInstanceOf(ApiError);
    await vi.runAllTimersAsync();
    await assertion;

    expect(onLost).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('returns undefined for 204 responses', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(request('/v1/boards/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
