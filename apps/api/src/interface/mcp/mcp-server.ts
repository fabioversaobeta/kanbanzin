import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { Container } from '../../container';
import { AppError } from '../../shared/errors';

const id = z.uuid();
const title = z.string().max(1000);

function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data ?? { ok: true }, null, 2) }],
  };
}

/** Expected failures become tool errors the model can read and react to; bugs still throw. */
async function run(action: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await action());
  } catch (error) {
    if (error instanceof AppError) {
      return {
        isError: true,
        content: [{ type: 'text', text: `${error.code}: ${error.message}` }],
      };
    }
    throw error;
  }
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

/**
 * Builds an MCP server scoped to one authenticated user. Every tool goes through the same use
 * cases as the HTTP API, so ownership checks and limits apply identically.
 *
 * Deleting boards and lists is deliberately not exposed: an agent can archive cards but cannot
 * wipe whole structures.
 */
export function createMcpServer(container: Container, userId: string): McpServer {
  const { boards, superpowers } = container;
  const server = new McpServer(
    { name: 'kanbanzin', version: '1.0.0' },
    {
      instructions:
        'Kanbanzin is a Kanban tool: boards contain ordered lists, lists contain ordered cards. ' +
        'Call list_boards, then get_board to see lists and cards with their ids. ' +
        'Positions are zero-based indexes. dueAt and labels need the "due-dates" and ' +
        '"color-labels" superpowers enabled on the board (set_board_superpower).',
    },
  );

  server.registerTool(
    'list_boards',
    { description: 'List the boards of the authenticated user.', annotations: READ_ONLY },
    () => run(() => boards.list.execute(userId)),
  );

  server.registerTool(
    'get_board',
    {
      description:
        'Get a board with all its lists and their cards (ids, titles, descriptions, positions).',
      inputSchema: { boardId: id },
      annotations: READ_ONLY,
    },
    ({ boardId }) => run(() => boards.get.execute(userId, boardId)),
  );

  server.registerTool(
    'create_board',
    {
      description: 'Create a board.',
      inputSchema: { title: z.string().max(500), color: z.string().max(20).optional() },
      annotations: WRITE,
    },
    (input) => run(() => boards.create.execute(userId, input)),
  );

  server.registerTool(
    'update_board',
    {
      description: 'Rename a board or change its color.',
      inputSchema: {
        boardId: id,
        title: z.string().max(500).optional(),
        color: z.string().max(20).optional(),
      },
      annotations: WRITE,
    },
    ({ boardId, ...patch }) => run(() => boards.update.execute(userId, boardId, patch)),
  );

  server.registerTool(
    'create_list',
    {
      description: 'Add a list at the end of a board.',
      inputSchema: { boardId: id, title: z.string().max(500) },
      annotations: WRITE,
    },
    ({ boardId, title: listTitle }) =>
      run(() => boards.createList.execute(userId, boardId, { title: listTitle })),
  );

  server.registerTool(
    'rename_list',
    {
      description: 'Rename a list.',
      inputSchema: { listId: id, title: z.string().max(500) },
      annotations: WRITE,
    },
    ({ listId, title: listTitle }) =>
      run(() => boards.renameList.execute(userId, listId, { title: listTitle })),
  );

  server.registerTool(
    'move_list',
    {
      description: 'Move a list to a zero-based position within its board.',
      inputSchema: { listId: id, index: z.number().int().min(0).max(100_000) },
      annotations: WRITE,
    },
    ({ listId, index }) => run(() => boards.moveList.execute(userId, listId, { index })),
  );

  server.registerTool(
    'archive_list_cards',
    {
      description: 'Archive every card of a list. The list itself is kept.',
      inputSchema: { listId: id },
      annotations: DESTRUCTIVE,
    },
    ({ listId }) => run(() => boards.archiveListCards.execute(userId, listId)),
  );

  server.registerTool(
    'create_card',
    {
      description:
        'Add a card at the end of a list. Optionally set description, dueAt (ISO 8601) and labels in the same call.',
      inputSchema: {
        listId: id,
        title,
        description: z.string().max(20_000).optional(),
        dueAt: z.string().max(40).nullable().optional(),
        labels: z.array(z.string().max(20)).max(20).optional(),
      },
      annotations: WRITE,
    },
    ({ listId, title: cardTitle, ...extra }) =>
      run(async () => {
        const card = await boards.createCard.execute(userId, listId, { title: cardTitle });
        const hasExtra = Object.values(extra).some((value) => value !== undefined);
        return hasExtra ? boards.updateCard.execute(userId, card.id, extra) : card;
      }),
  );

  server.registerTool(
    'update_card',
    {
      description:
        'Edit a card. Only the provided fields change. dueAt is ISO 8601 or null to clear.',
      inputSchema: {
        cardId: id,
        title: title.optional(),
        description: z.string().max(20_000).optional(),
        dueAt: z.string().max(40).nullable().optional(),
        labels: z.array(z.string().max(20)).max(20).optional(),
      },
      annotations: WRITE,
    },
    ({ cardId, ...patch }) => run(() => boards.updateCard.execute(userId, cardId, patch)),
  );

  server.registerTool(
    'move_card',
    {
      description:
        'Move a card to a list (the same or another one on its board) at a zero-based position.',
      inputSchema: { cardId: id, listId: id, index: z.number().int().min(0).max(100_000) },
      annotations: WRITE,
    },
    ({ cardId, listId, index }) =>
      run(() => boards.moveCard.execute(userId, cardId, { listId, index })),
  );

  server.registerTool(
    'delete_card',
    {
      description: 'Permanently delete a card.',
      inputSchema: { cardId: id },
      annotations: DESTRUCTIVE,
    },
    ({ cardId }) => run(() => boards.deleteCard.execute(userId, cardId)),
  );

  server.registerTool(
    'set_board_superpower',
    {
      description:
        'Enable or disable a superpower on a board. Known keys: "due-dates", "color-labels".',
      inputSchema: { boardId: id, key: z.string().min(1).max(64), enabled: z.boolean() },
      annotations: WRITE,
    },
    ({ boardId, key, enabled }) =>
      run(async () => ({
        enabled: await superpowers.setForBoard.execute(userId, boardId, key, { enabled }),
      })),
  );

  return server;
}
