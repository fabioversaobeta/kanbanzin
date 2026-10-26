import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/http';
import type * as HttpModule from '../../api/http';
import { AuthProvider } from './AuthContext';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './AuthPages';

const { refreshSession, login, register, forgotPassword } = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  forgotPassword: vi.fn(),
}));

vi.mock('../../api/http', async (importOriginal) => ({
  ...(await importOriginal<typeof HttpModule>()),
  refreshSession,
  setSessionLostHandler: vi.fn(),
}));
vi.mock('../../api/endpoints', () => ({
  authApi: { login, register, forgotPassword, logout: vi.fn() },
}));

function renderPage(page: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AuthProvider>{page}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('auth pages', () => {
  beforeEach(() => {
    refreshSession.mockRejectedValue(new ApiError(401, 'invalid_session', 'expired'));
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows a friendly message for wrong credentials', async () => {
    login.mockRejectedValue(new ApiError(401, 'invalid_credentials', 'Invalid'));
    renderPage(<LoginPage />);

    await userEvent.type(await screen.findByLabelText('E-mail'), 'ada@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('requires accepting the terms before registering', async () => {
    renderPage(<RegisterPage />);
    const submit = await screen.findByRole('button', { name: 'Criar conta' });
    expect(submit).toBeDisabled();

    await userEvent.click(screen.getByRole('checkbox'));
    expect(submit).toBeEnabled();
  });

  it('links to the terms and privacy policy from the sign-up form', async () => {
    renderPage(<RegisterPage />);
    expect(await screen.findByRole('link', { name: 'Termos de Uso' })).toHaveAttribute(
      'href',
      '/terms',
    );
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  it('confirms the recovery e-mail request without disclosing whether the account exists', async () => {
    forgotPassword.mockResolvedValue({ message: 'ok' });
    renderPage(<ForgotPasswordPage />);

    await userEvent.type(screen.getByLabelText('E-mail'), 'someone@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }));

    await waitFor(() => expect(forgotPassword).toHaveBeenCalledWith('someone@example.com'));
    expect(await screen.findByRole('status')).toHaveTextContent('Se o e-mail estiver cadastrado');
  });
});
