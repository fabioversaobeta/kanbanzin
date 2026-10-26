import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';
import type { AppConfig } from './config/env';
import { createContainer } from './container';
import type { Database } from './infrastructure/database/client';
import { registerAuthRoutes, REFRESH_COOKIE } from './interface/http/auth-routes';
import { registerBoardRoutes } from './interface/http/board-routes';
import { registerErrorHandling } from './interface/http/errors';
import type { Mailer } from './modules/identity/application/ports';
import type { Clock } from './shared/clock';

export interface RateLimitSettings {
  global: number;
  login: number;
  register: number;
  passwordReset: number;
  refresh: number;
}

const DEFAULT_LIMITS: RateLimitSettings = {
  global: 300,
  login: 10,
  register: 10,
  passwordReset: 5,
  refresh: 60,
};

export interface BuildAppOptions {
  config: AppConfig;
  db: Database;
  /** Overrides the e-mail transport (tests). */
  mailer?: Mailer;
  clock?: Clock;
  /** `false` disables rate limiting entirely (tests); partial values override the defaults. */
  rateLimits?: false | Partial<RateLimitSettings>;
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config, db } = options;

  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
    },
    // Trust only the proxies we deploy behind, so clients cannot spoof their IP via X-Forwarded-For.
    trustProxy: (_address: string, hop: number) => hop <= config.trustProxyHops,
    bodyLimit: 100 * 1024,
  });

  const container = createContainer({
    db,
    config,
    logger: app.log,
    mailer: options.mailer,
    clock: options.clock,
  });

  await app.register(helmet, {
    // The API only serves JSON: lock everything down.
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    referrerPolicy: { policy: 'no-referrer' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
  });
  await app.register(cors, {
    origin: config.webOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 600,
  });
  await app.register(cookie);

  const limits = { ...DEFAULT_LIMITS, ...(options.rateLimits || {}) };
  if (options.rateLimits !== false) {
    await app.register(rateLimit, { global: true, max: limits.global, timeWindow: '1 minute' });
  }

  // CSRF defence in depth on top of SameSite=Strict: browsers always send Origin on unsafe
  // methods, and requests that carry the refresh cookie must come from an allowed origin.
  app.addHook('onRequest', async (request, reply) => {
    if (!UNSAFE_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    const carriesSessionCookie = Boolean(request.cookies?.[REFRESH_COOKIE]);
    if (origin ? !config.webOrigins.includes(origin) : carriesSessionCookie) {
      return reply.status(403).send({
        error: { code: 'forbidden_origin', message: 'Origin not allowed.' },
      });
    }
  });

  app.addHook('onSend', async (request, reply) => {
    if (request.url.startsWith('/v1/') && !reply.hasHeader('cache-control')) {
      reply.header('Cache-Control', 'no-store');
    }
  });

  registerErrorHandling(app);

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/health/ready', async (_request, reply) => {
    try {
      await db.execute(sql`select 1 from users limit 1`);
      return { status: 'ready' };
    } catch (error) {
      app.log.error({ err: error }, 'Readiness check failed');
      return reply.status(503).send({ status: 'unavailable' });
    }
  });

  registerAuthRoutes(app, {
    container,
    secureCookies: config.isProduction,
    limits,
  });
  registerBoardRoutes(app, container);

  return app;
}
