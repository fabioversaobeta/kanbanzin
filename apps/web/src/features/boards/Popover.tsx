import { useEffect, useRef, useState, type ReactNode } from 'react';

interface PopoverProps {
  label: string;
  icon: string;
  children: ReactNode;
}

/** Toolbar button that toggles a glass panel; closes on outside click or Escape. */
export function Popover({ label, icon, children }: PopoverProps) {
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
    <div className="popover-anchor" ref={rootRef}>
      <button
        type="button"
        className="btn btn-small"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true">{icon}</span>
        <span className="hide-mobile">{label}</span>
        <span className="sr-only">{label}</span>
      </button>
      {open ? <div className="popover glass">{children}</div> : null}
    </div>
  );
}
