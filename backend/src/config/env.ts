import { z } from 'zod';

/**
 * Centralised, validated environment configuration.
 * The process refuses to start if required settings are missing or invalid,
 * so misconfiguration is caught at boot instead of at request time.
 */
const booleanString = z
  .enum(['true', 'false', '1', '0', 'yes', 'no'])
  .transform((v) => ['true', '1', 'yes'].includes(v));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_TIMEZONE: z.string().default('Asia/Kathmandu'),
  APP_VERSION: z.string().default('1.0.0-phase1'),
  MIGRATIONS_DIR: z.string().optional(),

  // Database
  DATABASE_HOST: z.string().min(1),
  DATABASE_PORT: z.coerce.number().int().positive().default(5432),
  DATABASE_NAME: z.string().min(1),
  DATABASE_USER: z.string().min(1),
  DATABASE_PASSWORD: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  SESSION_REMEMBER_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: booleanString.default('false'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  // Initial administrator (only used when the user does not exist yet)
  ADMIN_USERNAME: z.string().min(3).default('admin'),
  ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_FULL_NAME: z.string().default('System Administrator'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters').optional(),

  // FreeRADIUS
  RADIUS_HOST: z.string().default('freeradius'),
  RADIUS_AUTH_PORT: z.coerce.number().int().positive().default(1812),
  RADIUS_ACCT_PORT: z.coerce.number().int().positive().default(1813),
  RADIUS_SECRET: z.string().min(6),
  RADIUS_TIMEOUT_MS: z.coerce.number().int().positive().default(2000),
  RADIUS_HEALTHCHECK_USERNAME: z.string().default('testuser'),
  RADIUS_HEALTHCHECK_PASSWORD: z.string().default('testpassword'),

  // Data source strategy for dashboard metrics
  DATA_MODE: z.enum(['demo', 'live', 'hybrid']).default('hybrid'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
});

export type AppConfig = z.infer<typeof envSchema>;

function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(`\n[config] Invalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }
  return parsed.data;
}

export const config = loadConfig();

export const corsOrigins = config.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const isProduction = config.NODE_ENV === 'production';
