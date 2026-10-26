import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { loadConfig } from './config/env';

async function main() {
  const config = loadConfig();
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl:
      config.isProduction && !/localhost|127\.0\.0\.1|\.railway\.internal/.test(config.databaseUrl)
        ? { rejectUnauthorized: false }
        : undefined,
  });
  try {
    await migrate(drizzle(pool), { migrationsFolder: 'drizzle' });
    process.stdout.write('Migrations applied.\n');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `Migration failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
