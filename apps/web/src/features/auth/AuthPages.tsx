import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/endpoints';
import { errorMessage, m } from '../../i18n/messages';
import { Field } from '../../ui/Field';
import { AuthShell, FullPageSpinner } from '../../ui/layout';
import { useAuth } from './AuthContext';

function useSubmit<T extends unknown[]>(action: (...args: T) => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (...args: T) => {
    setBusy(true);
    setError(null);
    try {
      await action(...args);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}

function ErrorAlert({ message }: { message: string | null }) {
  return message ? (
    <div className="alert alert-error" role="alert">
      {message}
    </div>
  ) : null;
}

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    await login({ email, password });
    navigate('/', { replace: true });
  });

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  return (
    <AuthShell title={m.auth.loginTitle} subtitle={m.auth.loginSubtitle}>
      {notice ? <div className="alert alert-success">{notice}</div> : null}
      <form className="form" onSubmit={onSubmit}>
        <ErrorAlert message={error} />
        <Field
          label={m.auth.email}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label={m.auth.password}
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {m.auth.signIn}
        </button>
      </form>
      <div className="links">
        <Link to="/forgot-password">{m.auth.forgot}</Link>
        <span>
          {m.auth.noAccount} <Link to="/register">{m.auth.signUp}</Link>
        </span>
      </div>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { status, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const { busy, error, submit } = useSubmit(async () => {
    await register({ name, email, password, acceptTerms });
    navigate('/', { replace: true });
  });

  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to="/" replace />;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  return (
    <AuthShell title={m.auth.registerTitle} subtitle={m.auth.registerSubtitle}>
      <form className="form" onSubmit={onSubmit}>
        <ErrorAlert message={error} />
        <Field
          label={m.auth.name}
          autoComplete="name"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Field
          label={m.auth.email}
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label={m.auth.password}
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          hint={m.auth.passwordHint}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="check">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            required
          />
          <span>
            {m.auth.acceptPrefix}{' '}
            <Link to="/terms" target="_blank">
              {m.auth.terms}
            </Link>{' '}
            {m.auth.and}{' '}
            <Link to="/privacy" target="_blank">
              {m.auth.privacy}
            </Link>
            .
          </span>
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy || !acceptTerms}>
          {m.auth.signUp}
        </button>
      </form>
      <div className="links">
        <span>
          {m.auth.haveAccount} <Link to="/login">{m.auth.signIn}</Link>
        </span>
      </div>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const { busy, error, submit } = useSubmit(async () => {
    await authApi.forgotPassword(email);
    setDone(true);
  });

  return (
    <AuthShell title={m.auth.forgotTitle} subtitle={m.auth.forgotSubtitle}>
      {done ? (
        <div className="alert alert-success" role="status">
          {m.auth.forgotDone}
        </div>
      ) : (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <ErrorAlert message={error} />
          <Field
            label={m.auth.email}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {m.auth.forgotSend}
          </button>
        </form>
      )}
      <div className="links">
        <Link to="/login">{m.auth.backToLogin}</Link>
      </div>
    </AuthShell>
  );
}

/** The reset token travels in the URL fragment so it never reaches servers, logs or Referer headers. */
function readTokenFromHash(): string {
  return new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') ?? '';
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token] = useState(readTokenFromHash);
  const [password, setPassword] = useState('');
  const { busy, error, submit } = useSubmit(async () => {
    await authApi.resetPassword({ token, password });
    navigate('/login', { replace: true, state: { notice: m.auth.resetDone } });
  });

  useEffect(() => {
    // Remove the token from the address bar and history as soon as it has been read.
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  return (
    <AuthShell title={m.auth.resetTitle} subtitle={m.auth.resetSubtitle}>
      {token ? (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <ErrorAlert message={error} />
          <Field
            label={m.auth.newPassword}
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            hint={m.auth.passwordHint}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {m.auth.resetSave}
          </button>
        </form>
      ) : (
        <div className="alert alert-error" role="alert">
          {m.auth.resetMissingToken}
        </div>
      )}
      <div className="links">
        <Link to="/forgot-password">{m.auth.forgot}</Link>
        <Link to="/login">{m.auth.backToLogin}</Link>
      </div>
    </AuthShell>
  );
}
