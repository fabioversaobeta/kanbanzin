import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { memo, useState, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import type { BoardList } from '../../api/types';
import { m } from '../../i18n/messages';
import type { SuperpowerModule } from '../superpowers/registry';
import { SortableCard } from './CardItem';
import { Composer } from './Composer';

interface DragHandle {
  ref: Ref<HTMLDivElement>;
  props: HTMLAttributes<HTMLDivElement>;
}

interface ListShellProps {
  list: BoardList;
  handle?: DragHandle;
  onRename?(listId: string, title: string): void;
  onDelete?(listId: string): void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Visual shell of a list; shared by the real (sortable) column and the drag overlay. */
export function ListShell({ list, handle, onRename, onDelete, children, footer }: ListShellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.title);

  const commit = () => {
    const title = draft.trim();
    setEditing(false);
    if (title && title !== list.title) onRename?.(list.id, title);
    else setDraft(list.title);
  };

  return (
    <section className="list glass" aria-label={list.title}>
      <div className="list-header" ref={handle?.ref} {...handle?.props}>
        {editing ? (
          <input
            className="input list-title-input"
            autoFocus
            maxLength={100}
            aria-label={m.lists.titlePlaceholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit();
              if (event.key === 'Escape') {
                setDraft(list.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <h3 className="list-title" onClick={() => setEditing(true)} title={list.title}>
            {list.title}
          </h3>
        )}
        <span className="list-count" aria-label={m.lists.cards(list.cards.length)}>
          {list.cards.length}
        </span>
        {onDelete ? (
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-small"
            aria-label={m.lists.delete}
            title={m.lists.delete}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onDelete(list.id)}
          >
            🗑
          </button>
        ) : null}
      </div>
      <div className="cards">{children}</div>
      {footer}
    </section>
  );
}

interface ListColumnProps {
  list: BoardList;
  modules: readonly SuperpowerModule[];
  onRename(listId: string, title: string): void;
  onDelete(listId: string): void;
  onAddCard(listId: string, title: string): void;
  onOpenCard(cardId: string): void;
}

export const ListColumn = memo(function ListColumn({
  list,
  modules,
  onRename,
  onDelete,
  onAddCard,
  onOpenCard,
}: ListColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: list.id, data: { type: 'list' } });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'drag-ghost' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition, flex: '0 0 auto' }}
    >
      <ListShell
        list={list}
        handle={{ ref: setActivatorNodeRef, props: { ...attributes, ...listeners } }}
        onRename={onRename}
        onDelete={onDelete}
        footer={
          <Composer
            openLabel={m.cards.add}
            placeholder={m.cards.titlePlaceholder}
            submitLabel={m.cards.addConfirm}
            cancelLabel={m.cancel}
            maxLength={200}
            onSubmit={(title) => onAddCard(list.id, title)}
          />
        }
      >
        <SortableContext items={list.cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {list.cards.map((card) => (
            <SortableCard key={card.id} card={card} modules={modules} onOpen={onOpenCard} />
          ))}
        </SortableContext>
      </ListShell>
    </div>
  );
});
