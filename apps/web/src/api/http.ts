const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The access token lives only in memory: it is never written to storage reachable by XSS. */
let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setSessionLostHandler(handler: (() => void) | null): void {
  onSessionLost = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Sends the bearer token and transparently refreshes the session on 401. Default: true. */
  auth?: boolean;
}

async function send(path: string, { method = 'GET', body, auth = true }: RequestOptions) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'include',
  });
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as { error?: { code?: string; message?: string } };
    return new ApiError(
      response.status,
      payload.error?.code ?? 'unknown_error',
      payload.error?.message ?? 'Unexpected error.',
    );
  } catch {
    return new ApiError(response.status, 'unknown_error', 'Unexpected error.');
  }
}

export interface SessionPayload {
  accessToken: string;
  user: { id: string; email: string; name: string; createdAt: string };
}

let refreshInFlight: Promise<SessionPayload> | null = null;

/** Single-flight refresh: concurrent callers share one request (the token is rotated on use). */
export function refreshSession(): Promise<SessionPayload> {
  refreshInFlight ??= attemptRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function attemptRefresh(): Promise<SessionPayload> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await send('/v1/auth/refresh', { method: 'POST', auth: false });
    if (response.ok) {
      const session = (await response.json()) as SessionPayload;
      accessToken = session.accessToken;
      return session;
    }
    // Another tab may have just rotated the cookie: wait briefly and retry once with the new one.
    if (response.status === 401 && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }
    throw await toApiError(response);
  }
  throw new ApiError(401, 'invalid_session', 'Session expired.');
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);

  if (response.status === 401 && options.auth !== false) {
    try {
      await refreshSession();
      response = await send(path, options);
    } catch {
      accessToken = null;
      onSessionLost?.();
      throw new ApiError(401, 'invalid_session', 'Session expired.');
    }
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
