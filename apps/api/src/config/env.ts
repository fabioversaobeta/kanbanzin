import { z } from 'zod';

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
    WEB_ORIGIN: z.string().default('http://localhost:5173'),
    /** Number of reverse proxies in front of the app (Railway edge = 1). Used to read the client IP. */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().default('Kanbanzin <no-reply@kanbanzin.fabiobandacheski.com>'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.RESEND_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'Required in production' });
    }
  });

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  logLevel: string;
  databaseUrl: string;
  jwtSecret: string;
  /** Normalised list of allowed web origins (no trailing slash). */
  webOrigins: string[];
  trustProxyHops: number;
  resendApiKey?: string;
  mailFrom: string;
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  const env = parsed.data;
  const webOrigins = env.WEB_ORIGIN.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    databaseUrl: env.DATABASE_URL,
    jwtSecret: env.JWT_SECRET,
    webOrigins,
    trustProxyHops: env.TRUST_PROXY_HOPS,
    resendApiKey: env.RESEND_API_KEY || undefined,
    mailFrom: env.MAIL_FROM,
  };
}
