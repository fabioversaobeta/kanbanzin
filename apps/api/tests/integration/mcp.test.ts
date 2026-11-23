import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHeader, createTestContext, registerUser, type TestContext } from '../helpers/test-app';

interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
}

describe('MCP endpoint (integration)', () => {
  let ctx: TestContext;
  let secret: string;
  let nextId = 1;

  const rpc = (method: string, params: unknown, token = secret) =>
    ctx.app.inject({
      method: 'POST',
      url: '/mcp',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
      },
      payload: { jsonrpc: '2.0', id: nextId++, method, params },
    });

  async function callTool(name: string, args: Record<string, unknown> = {}, token = secret) {
    const response = await rpc('tools/call', { name, arguments: args }, token);
    expect(response.statusCode).toBe(200);
    const result = response.json<{ result: ToolResult }>().result;
    const data = result.isError ? null : JSON.parse(result.content[0]!.text);
    return { result, data };
  }

  beforeAll(async () => {
    ctx = await createTestContext();
    const user = await registerUser(ctx.app);
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/v1/me/tokens',
      headers: authHeader(user),
      payload: { name: 'Claude Code' },
    });
    secret = created.json<{ secret: string }>().secret;
  });
  afterAll(async () => {
    await ctx.close();
  });

  it('rejects requests without a valid token', async () => {
    expect((await rpc('tools/list', {}, 'kbz_nope')).statusCode).toBe(401);
    const anonymous = await ctx.app.inject({ method: 'POST', url: '/mcp', payload: {} });
    expect(anonymous.statusCode).toBe(401);
  });

  it('does not offer a stream or session endpoint', async () => {
    const response = await ctx.app.inject({ method: 'GET', url: '/mcp' });
    expect(response.statusCode).toBe(405);
  });

  it('lists the tools and leaves out board and list deletion', async () => {
    const response = await rpc('tools/list', {});
    const names = response
      .json<{ result: { tools: { name: string }[] } }>()
      .result.tools.map((tool) => tool.name);
    expect(names).toEqual(
      expect.arrayContaining(['list_boards', 'get_board', 'create_card', 'move_card']),
    );
    expect(names).not.toContain('delete_board');
    expect(names).not.toContain('delete_list');
  });

  it('orchestrates boards, lists and cards end to end', async () => {
    const { data: board } = await callTool('create_board', { title: 'Roadmap' });
    const { data: todo } = await callTool('create_list', { boardId: board.id, title: 'To do' });
    const { data: done } = await callTool('create_list', { boardId: board.id, title: 'Done' });

    await callTool('set_board_superpower', {
      boardId: board.id,
      key: 'color-labels',
      enabled: true,
    });
    const { data: card } = await callTool('create_card', {
      listId: todo.id,
      title: 'Ship MCP',
      description: 'Expose the board to agents',
      labels: ['green'],
    });
    expect(card.description).toBe('Expose the board to agents');
    expect(card.labels).toEqual(['green']);

    await callTool('move_card', { cardId: card.id, listId: done.id, index: 0 });
    const { data: view } = await callTool('get_board', { boardId: board.id });
    const doneList = view.lists.find((list: { id: string }) => list.id === done.id);
    expect(doneList.cards.map((c: { id: string }) => c.id)).toEqual([card.id]);

    const { data: boards } = await callTool('list_boards');
    expect(boards.map((b: { id: string }) => b.id)).toContain(board.id);
  });

  it('turns domain errors into readable tool errors', async () => {
    const { result } = await callTool('get_board', { boardId: crypto.randomUUID() });
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toContain('not_found');
  });

  it("never exposes another user's boards", async () => {
    const other = await registerUser(ctx.app);
    const otherToken = (
      await ctx.app.inject({
        method: 'POST',
        url: '/v1/me/tokens',
        headers: authHeader(other),
        payload: { name: 'Other' },
      })
    ).json<{ secret: string }>().secret;
    const { data: mine } = await callTool('create_board', { title: 'Private' });

    const { result } = await callTool('get_board', { boardId: mine.id }, otherToken);
    expect(result.isError).toBe(true);
    const { data: theirs } = await callTool('list_boards', {}, otherToken);
    expect(theirs).toEqual([]);
  });
});
