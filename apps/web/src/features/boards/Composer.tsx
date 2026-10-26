import { useEffect, useRef, useState } from 'react';

interface ComposerProps {
  openLabel: string;
  placeholder: string;
  submitLabel: string;
  cancelLabel: string;
  maxLength: number;
  onSubmit(title: string): void;
  className?: string;
}

/** Inline "add item" form: a ghost button that expands into a text box (Enter submits, Esc cancels). */
export function Composer({
  openLabel,
  placeholder,
  submitLabel,
  cancelLabel,
  maxLength,
  onSubmit,
  className,
}: ComposerProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    setTitle('');
  };

  const submit = () => {
    const value = title.trim();
    if (!value) return;
    onSubmit(value);
    setTitle('');
    inputRef.current?.focus();
  };

  if (!open) {
    return (
      <button
        type="button"
        className={`btn btn-ghost add-btn ${className ?? ''}`}
        onClick={() => setOpen(true)}
      >
        ＋ {openLabel}
      </button>
    );
  }

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={inputRef}
        className="input"
        style={{ minHeight: 64 }}
        rows={2}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={placeholder}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          } else if (event.key === 'Escape') {
            close();
          }
        }}
      />
      <div className="composer-actions">
        <button type="submit" className="btn btn-primary btn-small" disabled={!title.trim()}>
          {submitLabel}
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={close}>
          {cancelLabel}
        </button>
      </div>
    </form>
  );
}
