import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
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
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    /** Comma-separated list of frontend origins allowed to call the API. */
    FRONTEND_URLS: z
      .string()
      .default('http://localhost:5173')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    /** Timezone used to decide "today" / "current month" (salary generation). */
    APP_TIMEZONE: z.string().default('America/Santiago'),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === 'production' && !e.DATABASE_CA_CERT) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_CA_CERT'],
        message: 'Required in production to verify the database certificate',
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
