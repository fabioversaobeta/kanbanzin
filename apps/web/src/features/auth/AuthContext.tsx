import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '../../api/endpoints';
import { refreshSession, setSessionLostHandler } from '../../api/http';
import type { User } from '../../api/types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login(input: { email: string; password: string }): Promise<void>;
  register(input: {
    name: string;
    email: string;
    password: string;
    acceptTerms: boolean;
  }): Promise<void>;
  logout(): Promise<void>;
  setUser(user: User | null): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUserState] = useState<User | null>(null);

  const setUser = useCallback((next: User | null) => {
    setUserState(next);
    setStatus(next ? 'authenticated' : 'anonymous');
  }, []);

  // Restore the session from the refresh cookie when the app boots.
  useEffect(() => {
    let cancelled = false;
    refreshSession()
      .then((session) => !cancelled && setUser(session.user))
      .catch(() => !cancelled && setUser(null));
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  // The API client reports when the session cannot be renewed any more.
  useEffect(() => {
    setSessionLostHandler(() => {
      queryClient.clear();
      setUser(null);
    });
    return () => setSessionLostHandler(null);
  }, [queryClient, setUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      setUser,
      async login(input) {
        setUser((await authApi.login(input)).user);
      },
      async register(input) {
        setUser((await authApi.register(input)).user);
      },
      async logout() {
        try {
          await authApi.logout();
        } finally {
          queryClient.clear();
          setUser(null);
        }
      },
    }),
    [status, user, setUser, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
