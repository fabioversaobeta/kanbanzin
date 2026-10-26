import type { ComponentType } from 'react';
import type { Card, CardUpdate } from '../../api/types';
import { m } from '../../i18n/messages';

/**
 * Front-end half of a superpower. The API decides which superpowers exist and are enabled on a
 * board; this registry decides how each one looks. Unknown keys are ignored, so the two sides can
 * be deployed independently. See docs/superpowers.md to add a new one.
 */
export interface SuperpowerModule {
  key: string;
  /** Small badge rendered on the card face. */
  Badge?: ComponentType<{ card: Card }>;
  /** Editor rendered inside the card details dialog. */
  Editor?: ComponentType<{ card: Card; onChange(patch: CardUpdate): void }>;
}

export const LABEL_COLORS = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

const dateFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' });
const DAY = 86_400_000;

export function dueStatus(dueAt: string, now = Date.now()): 'late' | 'soon' | 'ok' {
  const diff = new Date(dueAt).getTime() - now;
  if (diff < 0) return 'late';
  return diff < DAY ? 'soon' : 'ok';
}

function DueBadge({ card }: { card: Card }) {
  if (!card.dueAt) return null;
  const status = dueStatus(card.dueAt);
  const className =
    status === 'late' ? 'badge badge-late' : status === 'soon' ? 'badge badge-soon' : 'badge';
  return (
    <span className={className} title={m.superpowers.dueDate}>
      🗓 {dateFormat.format(new Date(card.dueAt))}
      {status === 'late' ? ` · ${m.superpowers.late}` : ''}
    </span>
  );
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function DueEditor({ card, onChange }: { card: Card; onChange(patch: CardUpdate): void }) {
  return (
    <div className="field">
      <label htmlFor="card-due">{m.superpowers.dueDate}</label>
      <div className="row">
        <input
          id="card-due"
          className="input"
          type="datetime-local"
          style={{ flex: 1 }}
          value={toLocalInput(card.dueAt)}
          onChange={(event) => {
            const value = event.target.value;
            onChange({ dueAt: value ? new Date(value).toISOString() : null });
          }}
        />
        {card.dueAt ? (
          <button type="button" className="btn btn-small" onClick={() => onChange({ dueAt: null })}>
            {m.superpowers.clearDate}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function LabelsBadge({ card }: { card: Card }) {
  if (!card.labels?.length) return null;
  return (
    <>
      {card.labels.map((label) => (
        <span
          key={label}
          className={`label-pill label-${label}`}
          title={m.superpowers.labelNames[label]}
        />
      ))}
    </>
  );
}

function LabelsEditor({ card, onChange }: { card: Card; onChange(patch: CardUpdate): void }) {
  const selected = card.labels ?? [];
  return (
    <div className="field">
      <span className="field-label">{m.superpowers.labels}</span>
      <div className="label-picker">
        {LABEL_COLORS.map((label) => {
          const active = selected.includes(label);
          return (
            <button
              key={label}
              type="button"
              className={`label-chip label-${label}`}
              aria-pressed={active}
              aria-label={m.superpowers.labelNames[label]}
              title={m.superpowers.labelNames[label]}
              onClick={() =>
                onChange({
                  labels: active ? selected.filter((l) => l !== label) : [...selected, label],
                })
              }
            />
          );
        })}
      </div>
    </div>
  );
}

export const SUPERPOWER_MODULES: Record<string, SuperpowerModule> = {
  'due-dates': { key: 'due-dates', Badge: DueBadge, Editor: DueEditor },
  'color-labels': { key: 'color-labels', Badge: LabelsBadge, Editor: LabelsEditor },
};

/** Superpowers the UI knows how to render, in display order. */
export const KNOWN_SUPERPOWERS = Object.keys(SUPERPOWER_MODULES);

export function enabledModules(enabledKeys: readonly string[]): SuperpowerModule[] {
  return enabledKeys.flatMap((key) => {
    const module = SUPERPOWER_MODULES[key];
    return module ? [module] : [];
  });
}

export function superpowerCopy(key: string): { title: string; description: string } {
  const copy = (m.superpowers as Record<string, unknown>)[key];
  if (copy && typeof copy === 'object' && 'title' in copy) {
    return copy as { title: string; description: string };
  }
  return { title: key, description: '' };
}
