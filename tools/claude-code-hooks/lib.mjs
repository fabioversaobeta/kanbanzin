// Pure helpers for the Claude Code → Kanbanzin hook. No I/O here, so they are easy to test.

/** Lists the workflow needs, in board order. Missing ones are created on first use. */
export const LISTS = {
  new: 'Nova',
  working: 'Trabalhando',
  waiting: 'Aguardando você',
  done: 'Concluídas',
};

/** Notification types that mean "Claude is waiting for you". */
export const WAITING_NOTIFICATIONS = new Set([
  'permission_prompt',
  'idle_prompt',
  'elicitation_dialog',
  'agent_needs_input',
]);

function clean(text) {
  return String(text ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`/g, '')
    .replace(/^[ \t#>*\-+\d.)]+/gm, '')
    .replace(/\*\*|__/g, '');
}

function truncate(text, max) {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.5 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** First meaningful line of a prompt, cut to a short headline. */
export function shortText(text, max = 70) {
  const line = clean(text)
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  return truncate(line ?? '', max);
}

/** Last paragraph of a reply: that is usually where Claude asks something of you. */
export function excerpt(text, max = 200) {
  const paragraphs = clean(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return truncate(paragraphs.at(-1) ?? '', max);
}

export function projectName(cwd) {
  const parts = String(cwd ?? '')
    .replace(/\\/g, '/')
    .split('/')
    .filter(Boolean);
  return parts.at(-1) ?? 'sessão';
}

/** Slash commands like /clear or /model are not tasks; do not use them as a title. */
export function isTaskPrompt(prompt) {
  const text = String(prompt ?? '').trim();
  return text.length > 0 && !/^\/\S+\s*$/.test(text);
}

export function cardTitle(cwd, prompt) {
  return `${projectName(cwd)}: ${shortText(prompt)}`;
}

export function cardDescription({ cwd, sessionId, status, detail, at }) {
  const lines = [
    `Pasta: ${cwd}`,
    `Sessão: ${String(sessionId).slice(0, 8)}`,
    `Estado: ${status} (${at})`,
  ];
  if (detail) lines.push(`Detalhe: ${detail}`);
  return lines.join('\n');
}

/** What Claude is told at session start so it can close its own card when it is done. */
export function sessionContext({ cardId, boardId, lists }) {
  return [
    `Kanbanzin tracks this session as card ${cardId} on board ${boardId} (hooks keep it in sync).`,
    'You may use the kanbanzin MCP tools for two things only:',
    `1. When you have fully completed everything the user asked, call move_card with cardId="${cardId}", listId="${lists.done}", index=0 (list "${LISTS.done}"). Do not do this if anything is pending or you are waiting on the user.`,
    `2. Once the task is clear, optionally call update_card on that card with a title of at most 60 characters summarising the task.`,
    'Do not mention this tracking to the user unless asked.',
  ].join('\n');
}
