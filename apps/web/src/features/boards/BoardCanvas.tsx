import {
  closestCenter,
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  TouchSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useMemo, useState } from 'react';
import type { BoardList, BoardView } from '../../api/types';
import { m } from '../../i18n/messages';
import { ConfirmDialog } from '../../ui/Modal';
import { enabledModules } from '../superpowers/registry';
import { CardFace } from './CardItem';
import { Composer } from './Composer';
import { findListOfCard, moveCardInLists } from './boardCache';
import { ListColumn, ListShell } from './ListColumn';
import type { useBoardActions } from './queries';

type Actions = ReturnType<typeof useBoardActions>;

interface Draft {
  /** The cache snapshot the draft was derived from: a newer snapshot makes the draft obsolete. */
  base: BoardList[];
  lists: BoardList[];
}

type ActiveItem = { type: 'card' | 'list'; id: string };

const collisionDetection: CollisionDetection = (args) => {
  const activeType = args.active.data.current?.type;
  if (activeType === 'list') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.data.current?.type === 'list',
      ),
    });
  }
  const hits = pointerWithin(args).filter((hit) => hit.id !== args.active.id);
  const cardHits = hits.filter(
    (hit) => args.droppableContainers.find((c) => c.id === hit.id)?.data.current?.type === 'card',
  );
  if (cardHits.length) return cardHits;
  return hits.length ? hits : closestCorners(args);
};

interface BoardCanvasProps {
  view: BoardView;
  actions: Actions;
  onOpenCard(cardId: string): void;
}

export function BoardCanvas({ view, actions, onOpenCard }: BoardCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );
  const modules = useMemo(() => enabledModules(view.superpowers), [view.superpowers]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [active, setActive] = useState<ActiveItem | null>(null);
  const [listToDelete, setListToDelete] = useState<string | null>(null);

  const lists = draft && draft.base === view.lists ? draft.lists : view.lists;
  const activeCard =
    active?.type === 'card'
      ? lists.flatMap((l) => l.cards).find((card) => card.id === active.id)
      : undefined;
  const activeList = active?.type === 'list' ? lists.find((l) => l.id === active.id) : undefined;

  const onDragStart = ({ active: item }: DragStartEvent) => {
    setActive({ type: item.data.current?.type === 'list' ? 'list' : 'card', id: String(item.id) });
    setDraft({ base: view.lists, lists: view.lists });
  };

  // While dragging a card over another list, preview the move so the target list opens a gap.
  const onDragOver = ({ active: item, over }: DragOverEvent) => {
    if (item.data.current?.type !== 'card' || !over) return;
    const activeId = String(item.id);
    const overId = String(over.id);
    const overIsList = over.data.current?.type === 'list';

    setDraft((current) => {
      if (!current) return current;
      const from = findListOfCard(current.lists, activeId);
      const to = overIsList
        ? current.lists.find((l) => l.id === overId)
        : findListOfCard(current.lists, overId);
      if (!from || !to || from.id === to.id) return current;

      let index = to.cards.length;
      if (!overIsList) {
        const overIndex = to.cards.findIndex((c) => c.id === overId);
        const translated = item.rect.current.translated;
        const isBelow = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
        index = overIndex + (isBelow ? 1 : 0);
      }
      return { ...current, lists: moveCardInLists(current.lists, activeId, to.id, index) };
    });
  };

  const finish = () => {
    setActive(null);
    setDraft(null);
  };

  const onDragEnd = ({ active: item, over }: DragEndEvent) => {
    const activeId = String(item.id);
    const current = draft && draft.base === view.lists ? draft.lists : view.lists;
    setActive(null);

    if (item.data.current?.type === 'list') {
      const from = current.findIndex((l) => l.id === activeId);
      const to =
        over && over.data.current?.type === 'list'
          ? current.findIndex((l) => l.id === String(over.id))
          : -1;
      if (from < 0 || to < 0 || from === to) return setDraft(null);
      return actions.moveList.mutate(
        { id: activeId, index: to },
        { onSettled: () => setDraft(null) },
      );
    }

    const target = findListOfCard(current, activeId);
    const original = findListOfCard(view.lists, activeId);
    if (!target || !original) return setDraft(null);

    let index = target.cards.findIndex((c) => c.id === activeId);
    if (over && over.data.current?.type === 'card' && String(over.id) !== activeId) {
      const overIndex = target.cards.findIndex((c) => c.id === String(over.id));
      if (overIndex >= 0) index = overIndex;
    }
    const originalIndex = original.cards.findIndex((c) => c.id === activeId);
    if (target.id === original.id && index === originalIndex) return setDraft(null);

    actions.moveCard.mutate(
      { id: activeId, listId: target.id, index },
      { onSettled: () => setDraft(null) },
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
    >
      <div className="board-canvas">
        <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
          {lists.map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              modules={modules}
              onRename={(id, title) => actions.renameList.mutate({ id, title })}
              onDelete={setListToDelete}
              onAddCard={(listId, title) => actions.createCard.mutate({ listId, title })}
              onOpenCard={onOpenCard}
            />
          ))}
        </SortableContext>
        <div className="list-add glass">
          <Composer
            openLabel={m.lists.add}
            placeholder={m.lists.titlePlaceholder}
            submitLabel={m.lists.addConfirm}
            cancelLabel={m.cancel}
            maxLength={100}
            onSubmit={(title) => actions.createList.mutate(title)}
          />
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180 }}>
        {activeCard ? (
          <div className="card drag-overlay">
            <CardFace card={activeCard} modules={modules} />
          </div>
        ) : activeList ? (
          <div className="drag-overlay">
            <ListShell list={activeList}>
              {activeList.cards.map((card) => (
                <div key={card.id} className="card">
                  <CardFace card={card} modules={modules} />
                </div>
              ))}
            </ListShell>
          </div>
        ) : null}
      </DragOverlay>

      {listToDelete ? (
        <ConfirmDialog
          title={m.lists.delete}
          message={m.lists.deleteConfirm}
          confirmLabel={m.delete}
          onClose={() => setListToDelete(null)}
          onConfirm={() => {
            actions.deleteList.mutate(listToDelete);
            setListToDelete(null);
          }}
        />
      ) : null}
    </DndContext>
  );
}
