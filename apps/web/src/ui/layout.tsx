import { Link } from 'react-router-dom';
import type { CSSProperties, ReactNode } from 'react';
import { m } from '../i18n/messages';

export function AppBackground({
  background,
  children,
}: {
  background?: string;
  children: ReactNode;
}) {
  const style = background ? ({ '--app-bg': background } as CSSProperties) : undefined;
  return (
    <div className="app-bg" style={style}>
      {children}
    </div>
  );
}

export function Brand() {
  return (
    <Link to="/" className="brand">
      <img src="/favicon.svg" alt="" width={32} height={32} />
      <span>{m.appName}</span>
    </Link>
  );
}

export function LegalLinks() {
  return (
    <div className="row" style={{ justifyContent: 'center', fontSize: '0.85rem', gap: 18 }}>
      <Link to="/privacy">{m.footer.privacy}</Link>
      <Link to="/terms">{m.footer.terms}</Link>
    </div>
  );
}

export function FullPageSpinner() {
  return (
    <div className="center-page" role="status" aria-label={m.loading}>
      <div className="spinner" />
    </div>
  );
}

/** Shell shared by the sign in / sign up / recovery screens. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <AppBackground>
      <main className="center-page">
        <div className="auth-card glass">
          <Brand />
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {children}
          <LegalLinks />
        </div>
      </main>
    </AppBackground>
  );
}
