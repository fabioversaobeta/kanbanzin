import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { boardsApi, cardsApi, listsApi } from '../../api/endpoints';
import type { BoardSummary, BoardView, CardUpdate } from '../../api/types';
import {
  addCard,
  addList,
  clearListCards,
  moveCardInLists,
  moveListInLists,
  removeCard,
  removeList,
  renameList,
  replaceCard,
  mapView,
} from './boardCache';

export const keys = {
  boards: ['boards'] as const,
  board: (id: string) => ['boards', id] as const,
};

export function useBoards() {
  return useQuery({ queryKey: keys.boards, queryFn: boardsApi.list });
}

export function useBoard(id: string) {
  return useQuery({ queryKey: keys.board(id), queryFn: () => boardsApi.get(id) });
}

export function useCreateBoard() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: boardsApi.create,
    onSuccess: (board) => {
      client.setQueryData<BoardSummary[]>(keys.boards, (old = []) => [
        { id: board.id, title: board.title, color: board.color, updatedAt: board.updatedAt },
        ...old,
      ]);
    },
  });
}

/**
 * Board level mutations. Everything the user does on the canvas is applied to the cache first
 * (optimistic) and rolled back by refetching if the API rejects it, so the UI never waits.
 */
export function useBoardActions(boardId: string) {
  const client = useQueryClient();
  const key = keys.board(boardId);

  const patch = (change: (view: BoardView) => BoardView) =>
    client.setQueryData<BoardView>(key, (view) => (view ? change(view) : view));
  const resync = () => client.invalidateQueries({ queryKey: key });
  const optimistic = async (change: (view: BoardView) => BoardView) => {
    await client.cancelQueries({ queryKey: key });
    patch(change);
  };

  const updateBoard = useMutation({
    mutationFn: (input: { title?: string; color?: string }) => boardsApi.update(boardId, input),
    onMutate: (input) => optimistic((view) => ({ ...view, board: { ...view.board, ...input } })),
    onSuccess: (board) => {
      client.setQueryData<BoardSummary[]>(keys.boards, (old) =>
        old?.map((b) => (b.id === board.id ? { ...b, title: board.title, color: board.color } : b)),
      );
    },
    onError: resync,
  });

  const deleteBoard = useMutation({
    mutationFn: () => boardsApi.remove(boardId),
    onSuccess: () => {
      client.removeQueries({ queryKey: key });
      client.setQueryData<BoardSummary[]>(keys.boards, (old) =>
        old?.filter((b) => b.id !== boardId),
      );
    },
  });

  const setSuperpower = useMutation({
    mutationFn: (input: { key: string; enabled: boolean }) =>
      boardsApi.setSuperpower(boardId, input.key, input.enabled),
    // Cards gain/lose fields with the superpower, so the board is reloaded afterwards.
    onSuccess: resync,
  });

  const createList = useMutation({
    mutationFn: (title: string) => listsApi.create(boardId, title),
    onSuccess: (list) => patch((view) => addList(view, list)),
  });

  const renameListMutation = useMutation({
    mutationFn: (input: { id: string; title: string }) => listsApi.rename(input.id, input.title),
    onMutate: (input) => optimistic((view) => renameList(view, input.id, input.title)),
    onError: resync,
  });

  const moveList = useMutation({
    mutationFn: (input: { id: string; index: number }) => listsApi.move(input.id, input.index),
    onMutate: (input) =>
      optimistic((view) => mapView(view, moveListInLists(view.lists, input.id, input.index))),
    onError: resync,
  });

  const deleteList = useMutation({
    mutationFn: (id: string) => listsApi.remove(id),
    onMutate: (id) => optimistic((view) => removeList(view, id)),
    onError: resync,
  });

  const archiveListCards = useMutation({
    mutationFn: (id: string) => listsApi.archiveCards(id),
    onMutate: (id) => optimistic((view) => clearListCards(view, id)),
    onError: resync,
  });

  const createCard = useMutation({
    mutationFn: (input: { listId: string; title: string }) =>
      cardsApi.create(input.listId, input.title),
    onSuccess: (card) => patch((view) => addCard(view, card)),
  });

  const updateCard = useMutation({
    mutationFn: (input: { id: string; patch: CardUpdate }) =>
      cardsApi.update(input.id, input.patch),
    onSuccess: (card) => patch((view) => replaceCard(view, card)),
    onError: resync,
  });

  const moveCard = useMutation({
    mutationFn: (input: { id: string; listId: string; index: number }) =>
      cardsApi.move(input.id, input.listId, input.index),
    onMutate: (input) =>
      optimistic((view) =>
        mapView(view, moveCardInLists(view.lists, input.id, input.listId, input.index)),
      ),
    onError: resync,
  });

  const deleteCard = useMutation({
    mutationFn: (id: string) => cardsApi.remove(id),
    onMutate: (id) => optimistic((view) => removeCard(view, id)),
    onError: resync,
  });

  return {
    updateBoard,
    deleteBoard,
    setSuperpower,
    createList,
    renameList: renameListMutation,
    moveList,
    deleteList,
    archiveListCards,
    createCard,
    updateCard,
    moveCard,
    deleteCard,
  };
}
