import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Card } from '../../api/types';
import { dueStatus, enabledModules, SUPERPOWER_MODULES } from './registry';

const baseCard: Card = {
  id: '1',
  listId: 'l',
  title: 'Card',
  description: '',
  position: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('superpower registry', () => {
  it('only exposes modules for enabled and known superpowers', () => {
    expect(enabledModules([]).map((m) => m.key)).toEqual([]);
    expect(enabledModules(['due-dates', 'from-the-future']).map((m) => m.key)).toEqual([
      'due-dates',
    ]);
  });

  it('classifies due dates', () => {
    const now = new Date('2026-06-10T12:00:00Z').getTime();
    expect(dueStatus('2026-06-09T12:00:00Z', now)).toBe('late');
    expect(dueStatus('2026-06-10T18:00:00Z', now)).toBe('soon');
    expect(dueStatus('2026-06-20T12:00:00Z', now)).toBe('ok');
  });

  it('flags late cards on the due-date badge', () => {
    const Badge = SUPERPOWER_MODULES['due-dates']!.Badge!;
    render(<Badge card={{ ...baseCard, dueAt: '2020-01-01T00:00:00.000Z' }} />);
    expect(screen.getByText(/Atrasado/)).toBeInTheDocument();
  });

  it('toggles labels through the editor', async () => {
    const Editor = SUPERPOWER_MODULES['color-labels']!.Editor!;
    const onChange = vi.fn();
    render(<Editor card={{ ...baseCard, labels: ['red'] }} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: 'Azul' }));
    expect(onChange).toHaveBeenLastCalledWith({ labels: ['red', 'blue'] });

    await userEvent.click(screen.getByRole('button', { name: 'Vermelha' }));
    expect(onChange).toHaveBeenLastCalledWith({ labels: [] });
  });
});
