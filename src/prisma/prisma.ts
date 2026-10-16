import { PrismaPg } from '@prisma/adapter-pg';
import type { ConnectionOptions } from 'node:tls';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

/**
 * TLS is on unless DATABASE_SSL=false (local/CI only; Supabase requires it).
 * With the Supabase CA the server certificate is fully verified; without it
 * (development only, enforced in env.ts) traffic is still encrypted but the
 * certificate is not checked.
 */
function sslOptions(): ConnectionOptions | false {
  if (!env.DATABASE_SSL) return false;
  if (env.DATABASE_CA_CERT) {
    return { ca: env.DATABASE_CA_CERT, rejectUnauthorized: true };
  }
  console.warn(
    '[db] DATABASE_CA_CERT not set: database certificate is NOT verified',
  );
  return { rejectUnauthorized: false };
}

/** `sslmode` in the URL would override the `ssl` options below. */
function withoutSslMode(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('sslmode');
  return parsed.toString();
}

/**
 * Single PrismaClient shared by Nest services and Better Auth, so both use
 * the same connection pool.
 */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: withoutSslMode(env.DATABASE_URL),
    ssl: sslOptions(),
    max: 10,
  }),
});
