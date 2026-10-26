import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema';

/** Driver-agnostic database handle (node-postgres in production, PGlite in tests). */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export interface DatabaseHandle {
  db: Database;
  /** Applies pending SQL migrations (idempotent). */
  migrate(): Promise<void>;
  close(): Promise<void>;
}

const LOCAL_OR_PRIVATE_HOST = /localhost|127\.0\.0\.1|\.railway\.internal/;

export function createPostgresDatabase(
  connectionString: string,
  isProduction: boolean,
): DatabaseHandle {
  const useTls = isProduction && !LOCAL_OR_PRIVATE_HOST.test(connectionString);
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: useTls ? { rejectUnauthorized: false } : undefined,
  });
  const db = drizzle(pool, { schema });
  return {
    db,
    migrate: () => migrate(db, { migrationsFolder: 'drizzle' }),
    close: () => pool.end(),
  };
}

export { schema };
