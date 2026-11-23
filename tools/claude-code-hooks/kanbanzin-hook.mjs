#!/usr/bin/env node
// Claude Code hook that mirrors each session as a card on a Kanbanzin board.
//
//   SessionStart      → card in "Nova"
//   UserPromptSubmit  → "Trabalhando" (first prompt becomes a short title)
//   Notification/Stop → "Aguardando você"
//   PostToolUse       → back to "Trabalhando" after you approve something
//   SessionEnd        → description notes the session ended
//
// Moving a card to "Concluídas" is up to Claude (MCP move_card) or to you (drag it); this script
// never overrides a card that sits there. It never blocks or breaks a session: any failure,
// including the API being down, is swallowed.

import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LISTS,
  WAITING_NOTIFICATIONS,
  cardDescription,
  cardTitle,
  excerpt,
  isTaskPrompt,
  projectName,
  sessionContext,
} from './lib.mjs';

const HOME_DIR = join(homedir(), '.kanbanzin');
const SESSIONS_DIR = join(HOME_DIR, 'sessions');
const BREAKER_FILE = join(HOME_DIR, 'api-down-until');
const BREAKER_MS = 60_000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

class HttpError extends Error {
  constructor(status) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function loadConfig() {
  const file = (await readJson(join(HOME_DIR, 'config.json'))) ?? {};
  const apiUrl = (process.env.KANBANZIN_API_URL ?? file.apiUrl ?? '').replace(/\/+$/, '');
  const token = process.env.KANBANZIN_TOKEN ?? file.token ?? '';
  if (!apiUrl || !token) return null;
  return {
    apiUrl,
    token,
    board: process.env.KANBANZIN_BOARD ?? file.board ?? 'Sessões Claude Code',
    timeoutMs: Number(process.env.KANBANZIN_TIMEOUT_MS ?? file.timeoutMs ?? 2500),
    includeExcerpt: (process.env.KANBANZIN_EXCERPT ?? String(file.includeExcerpt ?? '1')) !== '0',
  };
}

function createApi(cfg) {
  return async function api(method, path, body) {
    let response;
    try {
      response = await fetch(`${cfg.apiUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${cfg.token}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
    } catch (error) {
      // Network failure or timeout: stop hammering a dead API for a while.
      await mkdir(HOME_DIR, { recursive: true }).catch(() => {});
      await writeFile(BREAKER_FILE, String(Date.now() + BREAKER_MS)).catch(() => {});
      throw error;
    }
    if (!response.ok) throw new HttpError(response.status);
    return response.status === 204 ? null : response.json();
  };
}

async function apiIsDown() {
  const until = Number(await readFile(BREAKER_FILE, 'utf8').catch(() => '0'));
  return Date.now() < until;
}

const sessionFile = (sessionId) =>
  join(SESSIONS_DIR, `${String(sessionId).replace(/[^\w-]/g, '_')}.json`);

async function saveState(sessionId, state) {
  await mkdir(SESSIONS_DIR, { recursive: true });
  await writeFile(sessionFile(sessionId), JSON.stringify(state));
}

async function pruneOldSessions() {
  const names = await readdir(SESSIONS_DIR).catch(() => []);
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const name of names) {
    const file = join(SESSIONS_DIR, name);
    const info = await stat(file).catch(() => null);
    if (info && info.mtimeMs < cutoff) await rm(file, { force: true });
  }
}

/** Finds (or creates) the board and the workflow lists. Returns their ids and the board view. */
async function resolveBoard(api, cfg) {
  const { boards } = await api('GET', '/v1/boards');
  let board = boards.find((b) => b.title === cfg.board);
  if (!board) board = (await api('POST', '/v1/boards', { title: cfg.board })).board;

  let view = await api('GET', `/v1/boards/${board.id}`);
  const lists = {};
  let created = false;
  for (const [key, title] of Object.entries(LISTS)) {
    let list = view.lists.find((l) => l.title === title);
    if (!list) {
      list = (await api('POST', `/v1/boards/${board.id}/lists`, { title })).list;
      created = true;
    }
    lists[key] = list.id;
  }
  if (created) view = await api('GET', `/v1/boards/${board.id}`);
  return { boardId: board.id, lists, view };
}

const now = () => new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

async function moveToTop(api, state, listKey) {
  await api('POST', `/v1/cards/${state.cardId}/move`, { listId: state.lists[listKey], index: 0 });
  state.current = listKey;
}

/** Loads the session's card, creating it (and the board structure) when missing. */
async function ensureCard(api, cfg, input) {
  let state = await readJson(sessionFile(input.session_id));
  const resolved = await resolveBoard(api, cfg);
  const exists = state && resolved.view.lists.some((l) => l.cards.some((c) => c.id === state.cardId));
  if (exists) {
    // Trust the board over the cache: you may have dragged the card somewhere else.
    const listId = resolved.view.lists.find((l) => l.cards.some((c) => c.id === state.cardId)).id;
    const current = Object.keys(LISTS).find((key) => resolved.lists[key] === listId) ?? 'working';
    return { ...state, boardId: resolved.boardId, lists: resolved.lists, current };
  }

  const cwd = input.cwd ?? process.cwd();
  const { card } = await api('POST', `/v1/lists/${resolved.lists.new}/cards`, {
    title: `${projectName(cwd)}: nova sessão`,
  });
  state = {
    cardId: card.id,
    boardId: resolved.boardId,
    lists: resolved.lists,
    current: 'new',
    titled: false,
    cwd,
  };
  await api('PATCH', `/v1/cards/${card.id}`, {
    description: cardDescription({
      cwd,
      sessionId: input.session_id,
      status: LISTS.new,
      at: now(),
    }),
  });
  await moveToTop(api, state, 'new');
  return state;
}

/** True when the card sits in "Concluídas" right now (Claude or you put it there). */
async function isDone(api, state) {
  const view = await api('GET', `/v1/boards/${state.boardId}`);
  const list = view.lists.find((l) => l.cards.some((c) => c.id === state.cardId));
  return list?.id === state.lists.done;
}

async function markWaiting(api, cfg, input, state, detail) {
  if (await isDone(api, state)) {
    state.current = 'done';
    return;
  }
  await api('PATCH', `/v1/cards/${state.cardId}`, {
    description: cardDescription({
      cwd: state.cwd,
      sessionId: input.session_id,
      status: LISTS.waiting,
      detail: cfg.includeExcerpt ? detail : undefined,
      at: now(),
    }),
  });
  await moveToTop(api, state, 'waiting');
}

const handlers = {
  async SessionStart(api, cfg, input) {
    await pruneOldSessions();
    const state = await ensureCard(api, cfg, input);
    await saveState(input.session_id, state);
    process.stdout.write(`${sessionContext(state)}\n`);
  },

  async UserPromptSubmit(api, cfg, input) {
    const state = await ensureCard(api, cfg, input);
    if (!state.titled && isTaskPrompt(input.prompt)) {
      await api('PATCH', `/v1/cards/${state.cardId}`, {
        title: cardTitle(state.cwd, input.prompt),
      });
      state.titled = true;
    }
    if (state.current !== 'working') await moveToTop(api, state, 'working');
    await saveState(input.session_id, state);
  },

  async Stop(api, cfg, input) {
    const state = await ensureCard(api, cfg, input);
    await markWaiting(api, cfg, input, state, excerpt(input.last_assistant_message));
    await saveState(input.session_id, state);
  },

  async Notification(api, cfg, input) {
    if (!WAITING_NOTIFICATIONS.has(input.notification_type)) return;
    const state = await ensureCard(api, cfg, input);
    if (state.current === 'waiting') return;
    await markWaiting(api, cfg, input, state, excerpt(input.message));
    await saveState(input.session_id, state);
  },

  async PostToolUse(api, cfg, input) {
    // Cheap exit: only relevant right after the user approved something that was waiting.
    const state = await readJson(sessionFile(input.session_id));
    if (!state || state.current !== 'waiting') return;
    const fresh = await ensureCard(api, cfg, input);
    if (fresh.current === 'waiting' && !(await isDone(api, fresh))) {
      await moveToTop(api, fresh, 'working');
    }
    await saveState(input.session_id, fresh);
  },

  async SessionEnd(api, cfg, input) {
    const state = await readJson(sessionFile(input.session_id));
    if (!state) return;
    await api('PATCH', `/v1/cards/${state.cardId}`, {
      description: cardDescription({
        cwd: state.cwd,
        sessionId: input.session_id,
        status: 'Sessão encerrada',
        detail: input.reason,
        at: now(),
      }),
    });
  },
};

function printSettings() {
  const script = resolve(dirname(fileURLToPath(import.meta.url)), 'kanbanzin-hook.mjs').replace(
    /\\/g,
    '/',
  );
  const hook = (extra = {}) => [
    { hooks: [{ type: 'command', command: 'node', args: [script], ...extra }] },
  ];
  process.stdout.write(
    `${JSON.stringify(
      {
        hooks: {
          SessionStart: hook({ timeout: 10 }),
          UserPromptSubmit: hook({ timeout: 10 }),
          PostToolUse: hook({ async: true, timeout: 10 }),
          Notification: hook({ async: true, timeout: 10 }),
          Stop: hook({ async: true, timeout: 10 }),
          SessionEnd: hook({ timeout: 10 }),
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  if (process.argv.includes('--print-settings')) return printSettings();

  const input = JSON.parse(await readStdin());
  const handler = handlers[input.hook_event_name];
  if (!handler || !input.session_id) return;

  const cfg = await loadConfig();
  if (!cfg || (await apiIsDown())) return;

  const api = createApi(cfg);
  try {
    await handler(api, cfg, input);
  } catch (error) {
    // A card or list deleted from under us: forget the session and retry once from scratch.
    if (error instanceof HttpError && error.status === 404) {
      await rm(sessionFile(input.session_id), { force: true });
      await handler(api, cfg, input);
      return;
    }
    throw error;
  }
}

// Silent by design: tracking must never get in the way of a session, so always exit 0.
main()
  .catch((error) => {
    // Set KANBANZIN_DEBUG=1 to see why a hook did nothing; otherwise stay quiet.
    if (process.env.KANBANZIN_DEBUG) process.stderr.write(`kanbanzin-hook: ${error?.stack ?? error}\n`);
  })
  .finally(() => {
    process.exitCode = 0;
  });
