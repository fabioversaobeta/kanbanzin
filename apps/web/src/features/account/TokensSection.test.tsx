import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokensSection } from './AccountPage';

const { listTokens, createToken, revokeToken } = vi.hoisted(() => ({
  listTokens: vi.fn(),
  createToken: vi.fn(),
  revokeToken: vi.fn(),
}));

vi.mock('../../api/endpoints', () => ({
  accountApi: { listTokens, createToken, revokeToken },
}));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({}) }));
vi.mock('../boards/BoardsPage', () => ({ TopBar: () => null }));

const existing = {
  id: 'tok-1',
  name: 'Notebook',
  prefix: 'kbz_ab12',
  expiresAt: '2027-02-01T00:00:00.000Z',
  lastUsedAt: null,
  createdAt: '2026-11-01T00:00:00.000Z',
};

describe('personal access tokens section', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lists tokens without exposing secrets and revokes one', async () => {
    listTokens.mockResolvedValue([existing]);
    revokeToken.mockResolvedValue(undefined);
    render(<TokensSection />);

    expect(await screen.findByText('Notebook')).toBeInTheDocument();
    expect(screen.getByText(/kbz_ab12/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    expect(revokeToken).toHaveBeenCalledWith('tok-1');
    expect(await screen.findByText('Nenhum token ativo.')).toBeInTheDocument();
  });

  it('shows the generated token once, inside the ready-to-run command', async () => {
    listTokens.mockResolvedValue([]);
    createToken.mockResolvedValue({ token: existing, secret: 'kbz_secret-value' });
    render(<TokensSection />);

    await userEvent.type(await screen.findByLabelText('Nome do token'), 'Claude Code');
    await userEvent.click(screen.getByRole('button', { name: 'Gerar token' }));

    expect(createToken).toHaveBeenCalledWith({ name: 'Claude Code', expiresInDays: 90 });
    const command = await screen.findByTestId('token-command');
    expect(command).toHaveTextContent('claude mcp add --transport http kanbanzin');
    expect(command).toHaveTextContent('Bearer kbz_secret-value');
  });
});
