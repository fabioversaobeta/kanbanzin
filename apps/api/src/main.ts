import { buildApp } from './app';
import { loadConfig } from './config/env';
import { createPostgresDatabase } from './infrastructure/database/client';

async function main() {
  const config = loadConfig();
  const { db, migrate, close } = createPostgresDatabase(config.databaseUrl, config.isProduction);
  await migrate();
  const app = await buildApp({ config, db });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await app.close();
    await close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
