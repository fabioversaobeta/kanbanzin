import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authHeader,
  createTestContext,
  registerUser,
  type RegisteredUser,
  type TestContext,
} from '../helpers/test-app';

describe('boards, lists and cards (integration)', () => {
  let ctx: TestContext;
  let owner: RegisteredUser;
  let stranger: RegisteredUser;

  beforeAll(async () => {
    ctx = await createTestContext();
    owner = await registerUser(ctx.app);
    stranger = await registerUser(ctx.app);
  });
  afterAll(async () => {
    await ctx.close();
  });

  const call = async (
    user: RegisteredUser,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    payload?: object,
  ) => ctx.app.inject({ method, url, headers: authHeader(user), payload });

  const createBoard = async (user = owner, title = 'Roadmap') => {
    const response = await call(user, 'POST', '/v1/boards', { title });
    return response.json().board as { id: string; title: string; color: string };
  };
  const createList = async (boardId: string, title: string) =>
    (await call(owner, 'POST', `/v1/boards/${boardId}/lists`, { title })).json().list as {
      id: string;
    };
  const createCard = async (listId: string, title: string) =>
    (await call(owner, 'POST', `/v1/lists/${listId}/cards`, { title })).json().card as {
      id: string;
    };
  const snapshot = async (boardId: string) =>
    (await call(owner, 'GET', `/v1/boards/${boardId}`)).json() as {
      board: { title: string; color: string };
      lists: { id: string; title: string; cards: { id: string; title: string }[] }[];
      superpowers: string[];
    };

  describe('boards', () => {
    it('creates boards with a default color and lists them', async () => {
      const board = await createBoard(owner, '  My   project ');
      expect(board).toMatchObject({ title: 'My project', color: 'ocean' });

      const list = await call(owner, 'GET', '/v1/boards');
      expect(list.json().boards.map((b: { id: string }) => b.id)).toContain(board.id);
    });

    it('lets the owner change the board color to a palette key or a custom hex', async () => {
      const board = await createBoard();
      const palette = await call(owner, 'PATCH', `/v1/boards/${board.id}`, { color: 'sunset' });
      expect(palette.json().board.color).toBe('sunset');

      const hex = await call(owner, 'PATCH', `/v1/boards/${board.id}`, { color: '#A1B2C3' });
      expect(hex.json().board.color).toBe('#a1b2c3');

      const invalid = await call(owner, 'PATCH', `/v1/boards/${board.id}`, {
        color: 'javascript:1',
      });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error.code).toBe('invalid_color');
    });

    it('renames and deletes boards (cascading to lists and cards)', async () => {
      const board = await createBoard();
      const list = await createList(board.id, 'To do');
      await createCard(list.id, 'Task');

      const renamed = await call(owner, 'PATCH', `/v1/boards/${board.id}`, { title: 'Renamed' });
      expect(renamed.json().board.title).toBe('Renamed');

      expect((await call(owner, 'DELETE', `/v1/boards/${board.id}`)).statusCode).toBe(204);
      expect((await call(owner, 'GET', `/v1/boards/${board.id}`)).statusCode).toBe(404);
    });

    it('validates titles', async () => {
      const empty = await call(owner, 'POST', '/v1/boards', { title: '   ' });
      expect(empty.statusCode).toBe(400);
      const tooLong = await call(owner, 'POST', '/v1/boards', { title: 'x'.repeat(101) });
      expect(tooLong.statusCode).toBe(400);
    });

    it('requires authentication', async () => {
      const response = await ctx.app.inject({ method: 'GET', url: '/v1/boards' });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('tenant isolation', () => {
    it('hides every resource from other users', async () => {
      const board = await createBoard();
      const list = await createList(board.id, 'Private');
      const card = await createCard(list.id, 'Secret');

      const attempts = [
        call(stranger, 'GET', `/v1/boards/${board.id}`),
        call(stranger, 'PATCH', `/v1/boards/${board.id}`, { title: 'Hacked' }),
        call(stranger, 'DELETE', `/v1/boards/${board.id}`),
        call(stranger, 'POST', `/v1/boards/${board.id}/lists`, { title: 'Injected' }),
        call(stranger, 'PATCH', `/v1/lists/${list.id}`, { title: 'Hacked' }),
        call(stranger, 'POST', `/v1/lists/${list.id}/move`, { index: 0 }),
        call(stranger, 'DELETE', `/v1/lists/${list.id}`),
        call(stranger, 'POST', `/v1/lists/${list.id}/cards`, { title: 'Injected' }),
        call(stranger, 'PATCH', `/v1/cards/${card.id}`, { title: 'Hacked' }),
        call(stranger, 'POST', `/v1/cards/${card.id}/move`, { listId: list.id, index: 0 }),
        call(stranger, 'DELETE', `/v1/cards/${card.id}`),
        call(stranger, 'PUT', `/v1/boards/${board.id}/superpowers/due-dates`, { enabled: true }),
      ];
      for (const response of await Promise.all(attempts)) {
        expect(response.statusCode).toBe(404);
      }

      const strangerBoards = await call(stranger, 'GET', '/v1/boards');
      expect(strangerBoards.json().boards.map((b: { id: string }) => b.id)).not.toContain(board.id);
      expect((await snapshot(board.id)).lists[0]?.cards[0]?.title).toBe('Secret');
    });

    it('does not let a card be moved into a list of another board', async () => {
      const boardA = await createBoard();
      const boardB = await createBoard();
      const listA = await createList(boardA.id, 'A');
      const listB = await createList(boardB.id, 'B');
      const card = await createCard(listA.id, 'Card');

      const response = await call(owner, 'POST', `/v1/cards/${card.id}/move`, {
        listId: listB.id,
        index: 0,
      });
      expect(response.statusCode).toBe(404);
    });

    it('rejects malformed identifiers', async () => {
      const response = await call(owner, 'GET', '/v1/boards/not-a-uuid');
      expect(response.statusCode).toBe(400);
    });
  });

  describe('lists', () => {
    it('keeps the order of creation and supports renaming, moving and deleting', async () => {
      const board = await createBoard();
      const todo = await createList(board.id, 'To do');
      const doing = await createList(board.id, 'Doing');
      const done = await createList(board.id, 'Done');
      expect((await snapshot(board.id)).lists.map((l) => l.title)).toEqual([
        'To do',
        'Doing',
        'Done',
      ]);

      await call(owner, 'POST', `/v1/lists/${done.id}/move`, { index: 0 });
      expect((await snapshot(board.id)).lists.map((l) => l.title)).toEqual([
        'Done',
        'To do',
        'Doing',
      ]);

      await call(owner, 'POST', `/v1/lists/${done.id}/move`, { index: 1 });
      expect((await snapshot(board.id)).lists.map((l) => l.title)).toEqual([
        'To do',
        'Done',
        'Doing',
      ]);

      await call(owner, 'PATCH', `/v1/lists/${todo.id}`, { title: 'Backlog' });
      await call(owner, 'DELETE', `/v1/lists/${doing.id}`);
      expect((await snapshot(board.id)).lists.map((l) => l.title)).toEqual(['Backlog', 'Done']);
    });
  });

  describe('cards', () => {
    it('reorders cards inside a list and moves them across lists', async () => {
      const board = await createBoard();
      const left = await createList(board.id, 'Left');
      const right = await createList(board.id, 'Right');
      const a = await createCard(left.id, 'A');
      await createCard(left.id, 'B');
      await createCard(left.id, 'C');

      await call(owner, 'POST', `/v1/cards/${a.id}/move`, { listId: left.id, index: 2 });
      let state = await snapshot(board.id);
      expect(state.lists[0]?.cards.map((c) => c.title)).toEqual(['B', 'C', 'A']);

      await call(owner, 'POST', `/v1/cards/${a.id}/move`, { listId: right.id, index: 0 });
      state = await snapshot(board.id);
      expect(state.lists[0]?.cards.map((c) => c.title)).toEqual(['B', 'C']);
      expect(state.lists[1]?.cards.map((c) => c.title)).toEqual(['A']);
    });

    it('stays correctly ordered after many consecutive moves to the same slot', async () => {
      const board = await createBoard();
      const list = await createList(board.id, 'Stress');
      const first = await createCard(list.id, 'first');
      await createCard(list.id, 'second');
      const moving = await createCard(list.id, 'moving');

      // Repeatedly inserting between the same neighbours halves the gap each time.
      for (let i = 0; i < 60; i += 1) {
        await call(owner, 'POST', `/v1/cards/${moving.id}/move`, { listId: list.id, index: 1 });
        await call(owner, 'POST', `/v1/cards/${first.id}/move`, { listId: list.id, index: 1 });
      }
      const titles = (await snapshot(board.id)).lists[0]?.cards.map((c) => c.title);
      expect(titles).toHaveLength(3);
      expect(new Set(titles).size).toBe(3);
    });

    it('edits and deletes cards', async () => {
      const board = await createBoard();
      const list = await createList(board.id, 'List');
      const card = await createCard(list.id, 'Old title');

      const response = await call(owner, 'PATCH', `/v1/cards/${card.id}`, {
        title: 'New title',
        description: 'Details',
      });
      expect(response.json().card).toMatchObject({ title: 'New title', description: 'Details' });

      expect((await call(owner, 'DELETE', `/v1/cards/${card.id}`)).statusCode).toBe(204);
      expect((await snapshot(board.id)).lists[0]?.cards).toEqual([]);
    });
  });

  describe('archiving the cards of a list', () => {
    it('clears the list without deleting it and keeps the archived cards in the export', async () => {
      const board = await createBoard();
      const todo = await createList(board.id, 'To do');
      const done = await createList(board.id, 'Done');
      const first = await createCard(todo.id, 'First');
      await createCard(todo.id, 'Second');
      await createCard(done.id, 'Untouched');

      expect((await call(owner, 'POST', `/v1/lists/${todo.id}/archive-cards`)).statusCode).toBe(
        204,
      );

      const view = await snapshot(board.id);
      expect(view.lists.map((l) => [l.title, l.cards.length])).toEqual([
        ['To do', 0],
        ['Done', 1],
      ]);
      expect((await call(owner, 'PATCH', `/v1/cards/${first.id}`, { title: 'x' })).statusCode).toBe(
        404,
      );

      const fresh = await createCard(todo.id, 'After archive');
      expect((await snapshot(board.id)).lists[0]?.cards.map((c) => c.id)).toEqual([fresh.id]);

      const exported = (await call(owner, 'GET', '/v1/me/export')).json() as {
        boards: {
          id: string;
          lists: { id: string; cards: { title: string; archivedAt: string | null }[] }[];
        }[];
      };
      const exportedCards = exported.boards
        .find((b) => b.id === board.id)!
        .lists.find((l) => l.id === todo.id)!.cards;
      expect(exportedCards.filter((c) => c.archivedAt !== null).map((c) => c.title)).toEqual([
        'First',
        'Second',
      ]);
    });

    it('is not available to other users', async () => {
      const board = await createBoard();
      const list = await createList(board.id, 'Private');
      const response = await call(stranger, 'POST', `/v1/lists/${list.id}/archive-cards`);
      expect(response.statusCode).toBe(404);
    });
  });

  describe('superpowers', () => {
    it('lists the catalog', async () => {
      const response = await call(owner, 'GET', '/v1/superpowers');
      const keys = response.json().superpowers.map((s: { key: string }) => s.key);
      expect(keys).toEqual(expect.arrayContaining(['due-dates', 'color-labels']));
    });

    it('hides and rejects superpower fields until the superpower is enabled', async () => {
      const board = await createBoard();
      const list = await createList(board.id, 'List');
      const card = await createCard(list.id, 'Card');

      expect((await snapshot(board.id)).superpowers).toEqual([]);
      const rejected = await call(owner, 'PATCH', `/v1/cards/${card.id}`, {
        dueAt: '2030-01-01T10:00:00.000Z',
      });
      expect(rejected.statusCode).toBe(400);
      expect(rejected.json().error.code).toBe('superpower_disabled');
      const rejectedLabels = await call(owner, 'PATCH', `/v1/cards/${card.id}`, {
        labels: ['red'],
      });
      expect(rejectedLabels.json().error.code).toBe('superpower_disabled');

      const enable = await call(owner, 'PUT', `/v1/boards/${board.id}/superpowers/due-dates`, {
        enabled: true,
      });
      expect(enable.json().superpowers).toEqual(['due-dates']);

      const updated = await call(owner, 'PATCH', `/v1/cards/${card.id}`, {
        dueAt: '2030-01-01T10:00:00.000Z',
      });
      expect(updated.json().card.dueAt).toBe('2030-01-01T10:00:00.000Z');
      expect(updated.json().card.labels).toBeUndefined();
    });

    it('keeps data when a superpower is disabled and restores it when re-enabled', async () => {
      const board = await createBoard();
      const list = await createList(board.id, 'List');
      const card = await createCard(list.id, 'Card');
      const url = `/v1/boards/${board.id}/superpowers/color-labels`;

      await call(owner, 'PUT', url, { enabled: true });
      await call(owner, 'PATCH', `/v1/cards/${card.id}`, { labels: ['red', 'blue', 'red'] });

      await call(owner, 'PUT', url, { enabled: false });
      const hidden = (await snapshot(board.id)).lists[0]?.cards[0] as Record<string, unknown>;
      expect(hidden.labels).toBeUndefined();

      await call(owner, 'PUT', url, { enabled: true });
      const restored = (await snapshot(board.id)).lists[0]?.cards[0] as Record<string, unknown>;
      expect(restored.labels).toEqual(['red', 'blue']);
    });

    it('rejects unknown superpowers and invalid label colors', async () => {
      const board = await createBoard();
      const unknown = await call(owner, 'PUT', `/v1/boards/${board.id}/superpowers/time-travel`, {
        enabled: true,
      });
      expect(unknown.statusCode).toBe(404);

      const list = await createList(board.id, 'List');
      const card = await createCard(list.id, 'Card');
      await call(owner, 'PUT', `/v1/boards/${board.id}/superpowers/color-labels`, {
        enabled: true,
      });
      const invalid = await call(owner, 'PATCH', `/v1/cards/${card.id}`, { labels: ['magenta'] });
      expect(invalid.statusCode).toBe(400);
      expect(invalid.json().error.code).toBe('invalid_label');
    });
  });
});
