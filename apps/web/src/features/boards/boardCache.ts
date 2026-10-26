import type { BoardList, BoardView, Card } from '../../api/types';

/**
 * Pure helpers that mirror, on the client, what the API does to a board.
 * They power optimistic updates and the live preview while dragging.
 */

export function findListOfCard(lists: readonly BoardList[], cardId: string): BoardList | undefined {
  return lists.find((list) => list.cards.some((card) => card.id === cardId));
}

function clamp(index: number, max: number): number {
  return Math.max(0, Math.min(index, max));
}

export function moveListInLists(
  lists: readonly BoardList[],
  listId: string,
  index: number,
): BoardList[] {
  const from = lists.findIndex((list) => list.id === listId);
  if (from < 0) return [...lists];
  const next = [...lists];
  const [moved] = next.splice(from, 1);
  next.splice(clamp(index, next.length), 0, moved as BoardList);
  return next;
}

/** Moves a card to `index` inside `listId` (index counts the target list without the card). */
export function moveCardInLists(
  lists: readonly BoardList[],
  cardId: string,
  listId: string,
  index: number,
): BoardList[] {
  const source = findListOfCard(lists, cardId);
  const card = source?.cards.find((c) => c.id === cardId);
  if (!source || !card || !lists.some((l) => l.id === listId)) return [...lists];

  return lists.map((list) => {
    const withoutCard = list.cards.filter((c) => c.id !== cardId);
    if (list.id !== listId) {
      return list === source ? { ...list, cards: withoutCard } : list;
    }
    const cards = [...withoutCard];
    cards.splice(clamp(index, cards.length), 0, { ...card, listId });
    return { ...list, cards };
  });
}

export function mapView(view: BoardView, lists: BoardList[]): BoardView {
  return { ...view, lists };
}

export function addList(view: BoardView, list: BoardList): BoardView {
  return mapView(view, [...view.lists, list]);
}

export function renameList(view: BoardView, listId: string, title: string): BoardView {
  return mapView(
    view,
    view.lists.map((l) => (l.id === listId ? { ...l, title } : l)),
  );
}

export function removeList(view: BoardView, listId: string): BoardView {
  return mapView(
    view,
    view.lists.filter((l) => l.id !== listId),
  );
}

export function addCard(view: BoardView, card: Card): BoardView {
  return mapView(
    view,
    view.lists.map((l) => (l.id === card.listId ? { ...l, cards: [...l.cards, card] } : l)),
  );
}

export function replaceCard(view: BoardView, card: Card): BoardView {
  return mapView(
    view,
    view.lists.map((l) => ({ ...l, cards: l.cards.map((c) => (c.id === card.id ? card : c)) })),
  );
}

export function removeCard(view: BoardView, cardId: string): BoardView {
  return mapView(
    view,
    view.lists.map((l) => ({ ...l, cards: l.cards.filter((c) => c.id !== cardId) })),
  );
}
