import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { ApiError } from './api/http';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from './features/auth/AuthPages';
import { BoardsPage } from './features/boards/BoardsPage';
import { AppBackground, FullPageSpinner } from './ui/layout';

// The board screen carries the drag-and-drop engine; keep it out of the initial bundle.
const BoardPage = lazy(() =>
  import('./features/boards/BoardPage').then((module) => ({ default: module.BoardPage })),
);
const AccountPage = lazy(() =>
  import('./features/account/AccountPage').then((module) => ({ default: module.AccountPage })),
);
const PrivacyPage = lazy(() =>
  import('./features/legal/LegalPages').then((module) => ({ default: module.PrivacyPage })),
);
const TermsPage = lazy(() =>
  import('./features/legal/LegalPages').then((module) => ({ default: module.TermsPage })),
);

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (4xx) will not fix themselves: only retry network/server failures.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  });
}

function RequireAuth() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <AppBackground>
        <FullPageSpinner />
      </AppBackground>
    );
  }
  return status === 'authenticated' ? <Outlet /> : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <AppBackground>
          <FullPageSpinner />
        </AppBackground>
      }
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<BoardsPage />} />
          <Route path="/b/:boardId" element={<BoardPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export function App() {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
