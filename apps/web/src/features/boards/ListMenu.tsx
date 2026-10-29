import { useEffect, useRef, useState } from 'react';

export interface ListMenuAction {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect(): void;
}

interface ListMenuProps {
  label: string;
  actions: readonly ListMenuAction[];
}

/** "⋯" button in a list header that opens a small menu; closes on outside click or Escape. */
export function ListMenu({ label, actions }: ListMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      className="list-menu"
      ref={rootRef}
      // The header is the drag handle; keep menu interactions from starting a drag.
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="btn btn-ghost btn-icon btn-small"
        aria-label={label}
        title={label}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div className="list-menu-panel glass" role="menu" aria-label={label}>
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              role="menuitem"
              className={action.danger ? 'list-menu-item is-danger' : 'list-menu-item'}
              disabled={action.disabled}
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
