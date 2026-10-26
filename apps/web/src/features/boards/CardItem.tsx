import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { memo } from 'react';
import type { Card } from '../../api/types';
import type { SuperpowerModule } from '../superpowers/registry';

interface CardFaceProps {
  card: Card;
  modules: readonly SuperpowerModule[];
}

/** Pure presentation of a card. Re-renders only when the card or enabled superpowers change. */
export const CardFace = memo(function CardFace({ card, modules }: CardFaceProps) {
  return (
    <>
      <p className="card-title">{card.title}</p>
      <div className="card-badges">
        {modules.map(({ key, Badge }) => (Badge ? <Badge key={key} card={card} /> : null))}
      </div>
    </>
  );
});

interface SortableCardProps extends CardFaceProps {
  onOpen(cardId: string): void;
}

export const SortableCard = memo(function SortableCard({
  card,
  modules,
  onOpen,
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card' },
  });

  return (
    <div
      ref={setNodeRef}
      className={`card${isDragging ? ' drag-ghost' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen(card.id);
        else listeners?.onKeyDown?.(event);
      }}
    >
      <CardFace card={card} modules={modules} />
    </div>
  );
});
