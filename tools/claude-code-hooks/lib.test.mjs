import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cardTitle,
  excerpt,
  isTaskPrompt,
  projectName,
  sessionContext,
  shortText,
} from './lib.mjs';

test('shortText keeps the first meaningful line and cuts at a word boundary', () => {
  assert.equal(shortText('  \n# Fix the login bug\nmore detail'), 'Fix the login bug');
  const long = 'Implement a brand new onboarding flow for first time users with email verification';
  const result = shortText(long, 40);
  assert.ok(result.length <= 41);
  assert.ok(result.endsWith('…'));
  assert.ok(!result.slice(0, -1).endsWith(' '));
});

test('shortText ignores fenced code and markdown noise', () => {
  assert.equal(shortText('```js\nconsole.log(1)\n```\n- **Add** tests'), 'Add tests');
  assert.equal(shortText(''), '');
});

test('excerpt takes the last paragraph, where Claude usually asks something', () => {
  const reply = 'Did the refactor.\n\nAll green.\n\nWant me to open a PR?';
  assert.equal(excerpt(reply), 'Want me to open a PR?');
  assert.ok(excerpt('x '.repeat(300), 50).length <= 51);
  assert.equal(excerpt(undefined), '');
});

test('projectName handles Windows and POSIX paths', () => {
  assert.equal(projectName('C:\\Users\\me\\Projetos\\kanbanzin'), 'kanbanzin');
  assert.equal(projectName('/home/me/app/'), 'app');
  assert.equal(projectName(''), 'sessão');
});

test('slash commands are not task prompts', () => {
  assert.equal(isTaskPrompt('/clear'), false);
  assert.equal(isTaskPrompt('   '), false);
  assert.equal(isTaskPrompt('/review the diff'), true);
  assert.equal(isTaskPrompt('fix the bug'), true);
  assert.equal(cardTitle('/a/kanbanzin', 'Fix the bug\nplease'), 'kanbanzin: Fix the bug');
});

test('session context tells Claude how to complete its own card', () => {
  const text = sessionContext({ cardId: 'c1', boardId: 'b1', lists: { done: 'l-done' } });
  assert.match(text, /card c1/);
  assert.match(text, /listId="l-done"/);
  assert.match(text, /move_card/);
});
