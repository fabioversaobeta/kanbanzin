/**
 * Local development server backed by an embedded PostgreSQL (PGlite): no Docker or database
 * installation required. Data is persisted in `.data/pglite` between runs.
 */
import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config/env';
import type { Database } from '../src/infrastructure/database/client';
import * as schema from '../src/infrastructure/database/schema';

async function main() {
  const config = loadConfig({
    DATABASE_URL: 'pglite://local',
    JWT_SECRET: process.env.JWT_SECRET ?? 'dev-only-secret-dev-only-secret-dev-only-secret',
    ...process.env,
  });
  mkdirSync('.data', { recursive: true });
  const client = new PGlite('.data/pglite');
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' });

  const app = await buildApp({ config, db: drizzle(client, { schema }) as unknown as Database });
  await app.listen({ port: config.port, host: '127.0.0.1' });
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exit(1);
});
