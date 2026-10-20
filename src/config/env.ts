import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(4001),
    /** Supabase session pooler (or direct) connection used by the app. */
    DATABASE_URL: z.url(),
    /**
     * Supabase root CA (PEM, "\n" escapes allowed) used to verify the database
     * TLS certificate. Required in production.
     */
    DATABASE_CA_CERT: z
      .string()
      .transform((v) => v.replace(/\\n/g, '\n'))
      .optional(),
    /** "false" disables TLS for a local/CI Postgres. Not allowed in production. */
    DATABASE_SSL: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    /**
     * Connections per pool. Each serverless instance has its own pool, so
     * keep it small in production (~3 on Vercel) to not exhaust Supabase.
     */
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    /** Comma-separated list of frontend origins allowed to call the API. */
    FRONTEND_URLS: z
      .string()
      .default('http://localhost:5174')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    /** Timezone used to decide "today" / "current month" (salary generation). */
    APP_TIMEZONE: z.string().default('America/Santiago'),
    /** Requests per minute and IP for the wallet API (auth has its own limit). */
    API_RATE_LIMIT: z.coerce.number().int().positive().default(120),
    /**
     * Express "trust proxy": "false" (default, direct connections), "true", or
     * the number of proxies in front of the app. Decides req.ip, the key of
     * the rate limit. Set it for the hosting in T05.
     */
    TRUST_PROXY: z
      .string()
      .default('false')
      .transform((v) => (v === 'true' ? true : v === 'false' ? false : Number(v)))
      .pipe(z.union([z.boolean(), z.number().int().nonnegative()])),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === 'production' && !e.DATABASE_CA_CERT) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_CA_CERT'],
        message: 'Required in production to verify the database certificate',
      });
    }
    if (e.NODE_ENV === 'production' && !e.DATABASE_SSL) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_SSL'],
        message: 'TLS cannot be disabled in production',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
