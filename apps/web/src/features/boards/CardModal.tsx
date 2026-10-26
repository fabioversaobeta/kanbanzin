import { useState } from 'react';
import type { Card, CardUpdate } from '../../api/types';
import { m } from '../../i18n/messages';
import { Modal } from '../../ui/Modal';
import type { SuperpowerModule } from '../superpowers/registry';

interface CardModalProps {
  card: Card;
  modules: readonly SuperpowerModule[];
  onChange(patch: CardUpdate): void;
  onDelete(): void;
  onClose(): void;
}

export function CardModal({ card, modules, onChange, onDelete, onClose }: CardModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const commitTitle = () => {
    const next = title.trim();
    if (!next) return setTitle(card.title);
    if (next !== card.title) onChange({ title: next });
  };
  const commitDescription = () => {
    if (description.trim() !== card.description) onChange({ description });
  };

  return (
    <Modal title={m.cards.details} onClose={onClose}>
      <div className="field">
        <label htmlFor="card-title">{m.cards.title}</label>
        <input
          id="card-title"
          className="input"
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={commitTitle}
        />
      </div>
      <div className="field">
        <label htmlFor="card-description">{m.cards.description}</label>
        <textarea
          id="card-description"
          className="input"
          maxLength={10_000}
          placeholder={m.cards.descriptionPlaceholder}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          onBlur={commitDescription}
        />
      </div>
      {modules.map(({ key, Editor }) =>
        Editor ? <Editor key={key} card={card} onChange={onChange} /> : null,
      )}
      <div className="modal-actions">
        {confirmingDelete ? (
          <>
            <span style={{ alignSelf: 'center' }}>{m.cards.deleteConfirm}</span>
            <button type="button" className="btn" onClick={() => setConfirmingDelete(false)}>
              {m.cancel}
            </button>
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              {m.delete}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn-danger btn-small"
            onClick={() => setConfirmingDelete(true)}
          >
            {m.cards.delete}
          </button>
        )}
      </div>
    </Modal>
  );
}
