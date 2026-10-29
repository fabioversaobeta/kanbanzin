import { describe, expect, it } from 'vitest';
import type { BoardList, BoardView, Card } from '../../api/types';
import {
  addCard,
  addList,
  clearListCards,
  findListOfCard,
  moveCardInLists,
  moveListInLists,
  removeCard,
  removeList,
  renameList,
  replaceCard,
} from './boardCache';

const card = (id: string, listId: string): Card => ({
  id,
  listId,
  title: id.toUpperCase(),
  description: '',
  position: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const list = (id: string, cardIds: string[]): BoardList => ({
  id,
  title: id,
  position: 0,
  cards: cardIds.map((c) => card(c, id)),
});

const ids = (lists: BoardList[]) => lists.map((l) => l.cards.map((c) => c.id));

const view = (lists: BoardList[]): BoardView => ({
  board: {
    id: 'b',
    title: 'Board',
    color: 'ocean',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  lists,
  superpowers: [],
});

describe('moveCardInLists', () => {
  const lists = [list('todo', ['a', 'b', 'c']), list('done', ['d'])];

  it('reorders inside the same list', () => {
    expect(ids(moveCardInLists(lists, 'a', 'todo', 2))).toEqual([['b', 'c', 'a'], ['d']]);
    expect(ids(moveCardInLists(lists, 'c', 'todo', 0))).toEqual([['c', 'a', 'b'], ['d']]);
  });

  it('moves across lists and updates the card listId', () => {
    const result = moveCardInLists(lists, 'b', 'done', 0);
    expect(ids(result)).toEqual([
      ['a', 'c'],
      ['b', 'd'],
    ]);
    expect(result[1]?.cards[0]?.listId).toBe('done');
  });

  it('clamps out-of-range indexes', () => {
    expect(ids(moveCardInLists(lists, 'a', 'done', 99))).toEqual([
      ['b', 'c'],
      ['d', 'a'],
    ]);
  });

  it('does not mutate its input and ignores unknown targets', () => {
    const before = JSON.stringify(lists);
    moveCardInLists(lists, 'a', 'done', 0);
    expect(JSON.stringify(lists)).toBe(before);
    expect(ids(moveCardInLists(lists, 'a', 'nowhere', 0))).toEqual(ids(lists));
    expect(ids(moveCardInLists(lists, 'ghost', 'done', 0))).toEqual(ids(lists));
  });
});

describe('moveListInLists', () => {
  const lists = [list('a', []), list('b', []), list('c', [])];

  it('moves a list to the requested slot', () => {
    expect(moveListInLists(lists, 'a', 2).map((l) => l.id)).toEqual(['b', 'c', 'a']);
    expect(moveListInLists(lists, 'c', 0).map((l) => l.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('view helpers', () => {
  const base = view([list('todo', ['a']), list('done', [])]);

  it('finds the list that holds a card', () => {
    expect(findListOfCard(base.lists, 'a')?.id).toBe('todo');
    expect(findListOfCard(base.lists, 'x')).toBeUndefined();
  });

  it('adds, renames and removes lists', () => {
    const added = addList(base, list('new', []));
    expect(added.lists.map((l) => l.id)).toEqual(['todo', 'done', 'new']);
    expect(renameList(added, 'new', 'Renamed').lists[2]?.title).toBe('Renamed');
    expect(removeList(added, 'todo').lists.map((l) => l.id)).toEqual(['done', 'new']);
  });

  it('clears only the cards of the given list', () => {
    const cleared = clearListCards(base, 'todo');
    expect(cleared.lists.map((l) => l.cards.length)).toEqual([0, base.lists[1]!.cards.length]);
    expect(cleared.lists.map((l) => l.id)).toEqual(['todo', 'done']);
  });

  it('adds, replaces and removes cards', () => {
    const added = addCard(base, card('z', 'done'));
    expect(ids(added.lists)).toEqual([['a'], ['z']]);
    const replaced = replaceCard(added, { ...card('z', 'done'), title: 'Updated' });
    expect(replaced.lists[1]?.cards[0]?.title).toBe('Updated');
    expect(ids(removeCard(replaced, 'a').lists)).toEqual([[], ['z']]);
  });
});
