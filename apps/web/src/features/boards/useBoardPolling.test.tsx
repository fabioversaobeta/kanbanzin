import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BOARD_POLL_MS, useBoard } from './queries';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../api/endpoints', () => ({ boardsApi: { get } }));

const view = { board: { id: 'b1' }, lists: [], superpowers: [] };

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useBoard polling', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('re-reads the board on an interval so external changes appear', async () => {
    get.mockResolvedValue(view);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const client = new QueryClient();
    renderHook(() => useBoard('b1'), { wrapper: wrapper(client) });

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(BOARD_POLL_MS + 100);
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
