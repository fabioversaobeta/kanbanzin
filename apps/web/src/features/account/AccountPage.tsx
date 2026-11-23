import { useEffect, useState, type FormEvent } from 'react';
import { accountApi } from '../../api/endpoints';
import { API_URL } from '../../api/http';
import type { PersonalToken } from '../../api/types';
import { errorMessage, m } from '../../i18n/messages';
import { Field } from '../../ui/Field';
import { AppBackground, LegalLinks } from '../../ui/layout';
import { useAuth } from '../auth/AuthContext';
import { TopBar } from '../boards/BoardsPage';

type Feedback = { kind: 'success' | 'error'; text: string } | null;

function FeedbackAlert({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return (
    <div
      className={`alert ${feedback.kind === 'error' ? 'alert-error' : 'alert-success'}`}
      role={feedback.kind === 'error' ? 'alert' : 'status'}
    >
      {feedback.text}
    </div>
  );
}

function ProfileSection() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [feedback, setFeedback] = useState<Feedback>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      setUser((await accountApi.updateProfile(name)).user);
      setFeedback({ kind: 'success', text: m.account.saved });
    } catch (error) {
      setFeedback({ kind: 'error', text: errorMessage(error) });
    }
  };

  return (
    <section className="glass card-panel">
      <h2>{m.account.profile}</h2>
      <form className="form" onSubmit={(event) => void onSubmit(event)}>
        <FeedbackAlert feedback={feedback} />
        <Field label={m.auth.email} value={user?.email ?? ''} readOnly />
        <Field
          label={m.auth.name}
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
          <button type="submit" className="btn btn-primary">
            {m.save}
          </button>
        </div>
      </form>
    </section>
  );
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await accountApi.changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setFeedback({ kind: 'success', text: m.account.passwordChanged });
    } catch (error) {
      setFeedback({ kind: 'error', text: errorMessage(error) });
    }
  };

  return (
    <section className="glass card-panel">
      <h2>{m.account.passwordSection}</h2>
      <form className="form" onSubmit={(event) => void onSubmit(event)}>
        <FeedbackAlert feedback={feedback} />
        <Field
          label={m.account.currentPassword}
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Field
          label={m.auth.newPassword}
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          maxLength={128}
          hint={m.auth.passwordHint}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <div>
          <button type="submit" className="btn btn-primary">
            {m.save}
          </button>
        </div>
      </form>
    </section>
  );
}

const TOKEN_EXPIRY_OPTIONS = [30, 90, 365];

export function TokensSection() {
  const [tokens, setTokens] = useState<PersonalToken[]>([]);
  const [name, setName] = useState('');
  const [days, setDays] = useState(90);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    accountApi
      .listTokens()
      .then(setTokens)
      .catch((error: unknown) => setFeedback({ kind: 'error', text: errorMessage(error) }));
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const { token, secret } = await accountApi.createToken({ name, expiresInDays: days });
      setTokens((current) => [token, ...current]);
      setCreated(secret);
      setCopied(false);
      setName('');
      setFeedback({ kind: 'success', text: m.account.tokenCreated });
    } catch (error) {
      setFeedback({ kind: 'error', text: errorMessage(error) });
    }
  };

  const revoke = async (id: string) => {
    try {
      await accountApi.revokeToken(id);
      setTokens((current) => current.filter((token) => token.id !== id));
    } catch (error) {
      setFeedback({ kind: 'error', text: errorMessage(error) });
    }
  };

  const command = created
    ? `claude mcp add --transport http kanbanzin ${API_URL}/mcp --header "Authorization: Bearer ${created}"`
    : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

  return (
    <section className="glass card-panel">
      <h2>{m.account.tokensSection}</h2>
      <p style={{ color: 'var(--text-soft)' }}>{m.account.tokensText}</p>
      <form className="form" onSubmit={(event) => void create(event)}>
        <FeedbackAlert feedback={feedback} />
        <Field
          label={m.account.tokenName}
          hint={m.account.tokenNameHint}
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="field">
          <label htmlFor="token-expiry">{m.account.tokenExpiry}</label>
          <select
            id="token-expiry"
            className="input"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {TOKEN_EXPIRY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {m.account.tokenDays(option)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
            {m.account.tokenCreate}
          </button>
        </div>
      </form>

      {created ? (
        <div className="stack" style={{ marginTop: 16 }}>
          <p style={{ margin: 0 }}>{m.account.tokenCommand}</p>
          <code
            style={{ display: 'block', overflowWrap: 'anywhere', userSelect: 'all' }}
            data-testid="token-command"
          >
            {command}
          </code>
          <div>
            <button type="button" className="btn btn-small" onClick={() => void copy()}>
              {copied ? m.account.tokenCopied : m.account.tokenCopy}
            </button>
          </div>
        </div>
      ) : null}

      <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: '16px 0 0' }}>
        {tokens.length === 0 ? (
          <li style={{ color: 'var(--text-soft)' }}>{m.account.tokenNone}</li>
        ) : null}
        {tokens.map((token) => (
          <li key={token.id} className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              <strong>{token.name}</strong> <code>{token.prefix}…</code>
              <br />
              <small style={{ color: 'var(--text-soft)' }}>
                {m.account.tokenExpires} {formatDate(token.expiresAt)} · {m.account.tokenLastUsed}{' '}
                {token.lastUsedAt ? formatDate(token.lastUsedAt) : m.account.tokenNeverUsed}
              </small>
            </span>
            <button
              type="button"
              className="btn btn-small btn-danger"
              onClick={() => void revoke(token.id)}
            >
              {m.account.tokenRevoke}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PrivacySection() {
  const { setUser } = useAuth();
  const [password, setPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);

  const download = async () => {
    try {
      const data = await accountApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'kanbanzin-meus-dados.json';
      link.click();
      URL.revokeObjectURL(url);
      setFeedback({ kind: 'success', text: m.account.exportDone });
    } catch (error) {
      setFeedback({ kind: 'error', text: errorMessage(error) });
    }
  };

  const remove = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await accountApi.deleteAccount(password);
      setUser(null);
    } catch (error) {
      setFeedback({ kind: 'error', text: errorMessage(error) });
    }
  };

  return (
    <>
      <section className="glass card-panel">
        <h2>{m.account.privacySection}</h2>
        <p style={{ color: 'var(--text-soft)' }}>{m.account.privacyText}</p>
        <FeedbackAlert feedback={feedback} />
        <button type="button" className="btn" onClick={() => void download()}>
          ⬇ {m.account.export}
        </button>
      </section>
      <section className="glass card-panel danger-zone">
        <h2>{m.account.dangerTitle}</h2>
        <p style={{ color: 'var(--text-soft)' }}>{m.account.dangerText}</p>
        <form className="form" onSubmit={(event) => void remove(event)}>
          <Field
            label={m.account.deleteConfirmPassword}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div>
            <button type="submit" className="btn btn-danger" disabled={!password}>
              {m.account.deleteAccount}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}

export function AccountPage() {
  return (
    <AppBackground>
      <TopBar />
      <main className="page">
        <h1>{m.account.title}</h1>
        <div className="stack">
          <ProfileSection />
          <PasswordSection />
          <TokensSection />
          <PrivacySection />
        </div>
        <div style={{ marginTop: 40 }}>
          <LegalLinks />
        </div>
      </main>
    </AppBackground>
  );
}
