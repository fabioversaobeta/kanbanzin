import { Resend } from 'resend';
import type { Logger } from '../../../shared/logger';
import type { Mailer, PasswordResetEmail } from '../application/ports';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderPasswordResetEmail(email: PasswordResetEmail): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'Redefinição de senha - Kanbanzin';
  const text = [
    `Olá, ${email.name}!`,
    '',
    'Recebemos um pedido para redefinir a senha da sua conta no Kanbanzin.',
    `Use o link abaixo (válido por ${email.expiresInMinutes} minutos):`,
    email.resetUrl,
    '',
    'Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.',
  ].join('\n');
  const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:24px;background:#f4f6fb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c2333">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px">
      <h1 style="margin:0 0 16px;font-size:22px">Redefinição de senha</h1>
      <p>Olá, ${escapeHtml(email.name)}!</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta no Kanbanzin. O link é válido por ${email.expiresInMinutes} minutos.</p>
      <p style="margin:28px 0">
        <a href="${escapeHtml(email.resetUrl)}" style="background:#3b6cf6;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600">Criar nova senha</a>
      </p>
      <p style="font-size:13px;color:#5b667d">Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.</p>
    </div>
  </body>
</html>`;
  return { subject, html, text };
}

export class ResendMailer implements Mailer {
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    const { subject, html, text } = renderPasswordResetEmail(email);
    const { error } = await this.client.emails.send({
      from: this.from,
      to: email.to,
      subject,
      html,
      text,
    });
    if (error) throw new Error(`Resend rejected the e-mail: ${error.message}`);
  }
}

/** Development fallback: prints the e-mail instead of sending it. Never used in production. */
export class ConsoleMailer implements Mailer {
  constructor(private readonly logger: Logger) {}

  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    this.logger.info({ to: email.to, resetUrl: email.resetUrl }, 'Password reset e-mail (console)');
  }
}
