import { request, setAccessToken, type SessionPayload } from './http';
import type { Board, BoardList, BoardSummary, BoardView, Card, CardUpdate, User } from './types';

export const authApi = {
  async register(input: { name: string; email: string; password: string; acceptTerms: boolean }) {
    const session = await request<SessionPayload>('/v1/auth/register', {
      method: 'POST',
      body: input,
      auth: false,
    });
    setAccessToken(session.accessToken);
    return session;
  },
  async login(input: { email: string; password: string }) {
    const session = await request<SessionPayload>('/v1/auth/login', {
      method: 'POST',
      body: input,
      auth: false,
    });
    setAccessToken(session.accessToken);
    return session;
  },
  async logout() {
    try {
      await request<void>('/v1/auth/logout', { method: 'POST', auth: false });
    } finally {
      setAccessToken(null);
    }
  },
  forgotPassword: (email: string) =>
    request<{ message: string }>('/v1/auth/password/forgot', {
      method: 'POST',
      body: { email },
      auth: false,
    }),
  resetPassword: (input: { token: string; password: string }) =>
    request<void>('/v1/auth/password/reset', { method: 'POST', body: input, auth: false }),
};

export const accountApi = {
  updateProfile: (name: string) =>
    request<{ user: User }>('/v1/me', { method: 'PATCH', body: { name } }),
  async changePassword(input: { currentPassword: string; newPassword: string }) {
    const session = await request<{ accessToken: string }>('/v1/me/password', {
      method: 'POST',
      body: input,
    });
    setAccessToken(session.accessToken);
  },
  exportData: () => request<unknown>('/v1/me/export'),
  async deleteAccount(password: string) {
    await request<void>('/v1/me', { method: 'DELETE', body: { password } });
    setAccessToken(null);
  },
};

export const boardsApi = {
  list: () => request<{ boards: BoardSummary[] }>('/v1/boards').then((r) => r.boards),
  create: (input: { title: string; color?: string }) =>
    request<{ board: Board }>('/v1/boards', { method: 'POST', body: input }).then((r) => r.board),
  get: (id: string) => request<BoardView>(`/v1/boards/${id}`),
  update: (id: string, patch: { title?: string; color?: string }) =>
    request<{ board: Board }>(`/v1/boards/${id}`, { method: 'PATCH', body: patch }).then(
      (r) => r.board,
    ),
  remove: (id: string) => request<void>(`/v1/boards/${id}`, { method: 'DELETE' }),
  setSuperpower: (id: string, key: string, enabled: boolean) =>
    request<{ superpowers: string[] }>(`/v1/boards/${id}/superpowers/${key}`, {
      method: 'PUT',
      body: { enabled },
    }).then((r) => r.superpowers),
};

export const listsApi = {
  create: (boardId: string, title: string) =>
    request<{ list: BoardList }>(`/v1/boards/${boardId}/lists`, {
      method: 'POST',
      body: { title },
    }).then((r) => r.list),
  rename: (id: string, title: string) =>
    request<void>(`/v1/lists/${id}`, { method: 'PATCH', body: { title } }),
  move: (id: string, index: number) =>
    request<void>(`/v1/lists/${id}/move`, { method: 'POST', body: { index } }),
  remove: (id: string) => request<void>(`/v1/lists/${id}`, { method: 'DELETE' }),
};

export const cardsApi = {
  create: (listId: string, title: string) =>
    request<{ card: Card }>(`/v1/lists/${listId}/cards`, { method: 'POST', body: { title } }).then(
      (r) => r.card,
    ),
  update: (id: string, patch: CardUpdate) =>
    request<{ card: Card }>(`/v1/cards/${id}`, { method: 'PATCH', body: patch }).then(
      (r) => r.card,
    ),
  move: (id: string, listId: string, index: number) =>
    request<void>(`/v1/cards/${id}/move`, { method: 'POST', body: { listId, index } }),
  remove: (id: string) => request<void>(`/v1/cards/${id}`, { method: 'DELETE' }),
};
