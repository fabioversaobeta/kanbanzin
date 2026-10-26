import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildApp, type BuildAppOptions } from '../../src/app';
import { loadConfig } from '../../src/config/env';
import type { Database } from '../../src/infrastructure/database/client';
import * as schema from '../../src/infrastructure/database/schema';
import type { Mailer, PasswordResetEmail } from '../../src/modules/identity/application/ports';

export const WEB_ORIGIN = 'http://localhost:5173';
export const STRONG_PASSWORD = 'correct-horse-battery';

export class RecordingMailer implements Mailer {
  readonly sent: PasswordResetEmail[] = [];

  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    this.sent.push(email);
  }

  lastResetToken(): string {
    const last = this.sent.at(-1);
    if (!last) throw new Error('No e-mail was sent');
    return new URL(last.resetUrl).hash.replace('#token=', '');
  }
}

export interface TestContext {
  app: FastifyInstance;
  db: Database;
  mailer: RecordingMailer;
  close(): Promise<void>;
}

export async function createTestContext(
  overrides: Partial<Pick<BuildAppOptions, 'rateLimits' | 'clock'>> = {},
): Promise<TestContext> {
  const client = new PGlite();
  const db = drizzle(client, { schema }) as unknown as Database;
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' });

  const mailer = new RecordingMailer();
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'pglite://memory',
    JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
    WEB_ORIGIN: WEB_ORIGIN,
  });
  const app = await buildApp({
    config,
    db,
    mailer,
    rateLimits: overrides.rateLimits ?? false,
    clock: overrides.clock,
  });
  await app.ready();

  return {
    app,
    db,
    mailer,
    close: async () => {
      await app.close();
      await client.close();
    },
  };
}

export interface RegisteredUser {
  email: string;
  password: string;
  accessToken: string;
  refreshCookie: string;
  userId: string;
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

export function readRefreshCookie(response: LightMyRequestResponse): string {
  const cookie = response.cookies.find((c) => c.name === 'kz_refresh');
  if (!cookie) throw new Error('Refresh cookie not set');
  return cookie.value;
}

export async function registerUser(
  app: FastifyInstance,
  overrides: Partial<{ email: string; password: string; name: string }> = {},
): Promise<RegisteredUser> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? STRONG_PASSWORD;
  const response = await app.inject({
    method: 'POST',
    url: '/v1/auth/register',
    payload: { name: overrides.name ?? 'Test User', email, password, acceptTerms: true },
  });
  if (response.statusCode !== 201) throw new Error(`Register failed: ${response.body}`);
  const body = response.json<{ accessToken: string; user: { id: string } }>();
  return {
    email,
    password,
    accessToken: body.accessToken,
    refreshCookie: readRefreshCookie(response),
    userId: body.user.id,
  };
}

export function authHeader(user: Pick<RegisteredUser, 'accessToken'>) {
  return { authorization: `Bearer ${user.accessToken}` };
}
