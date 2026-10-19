import type { ThrottlerStorage } from '@nestjs/throttler';
import type { PrismaClient } from '../generated/prisma/client.js';

/** Not exported by the package index. */
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

interface Row {
  hits: number;
  expires_at: Date;
  blocked_until: Date | null;
  db_now: Date;
}

/**
 * @nestjs/throttler storage on Postgres (table api_rate_limit), so the limit
 * is shared by every instance (Vercel functions, T05) and survives restarts.
 * Fixed window per key: the first hit opens a window of `ttl` ms; going over
 * `limit` blocks the key for `blockDuration` ms. One atomic upsert per request.
 */
export class PrismaThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly prisma: PrismaClient) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): Promise<ThrottlerStorageRecord> {
    const [row] = await this.prisma.$queryRaw<Row[]>`
      INSERT INTO api_rate_limit (key, hits, expires_at)
      VALUES (${key}, 1, now() + make_interval(secs => ${ttl}::float8 / 1000))
      ON CONFLICT (key) DO UPDATE SET
        hits = CASE WHEN api_rate_limit.expires_at <= now() THEN 1
                    ELSE api_rate_limit.hits + 1 END,
        expires_at = CASE WHEN api_rate_limit.expires_at <= now() THEN EXCLUDED.expires_at
                          ELSE api_rate_limit.expires_at END
      RETURNING hits, expires_at, blocked_until, now() AS db_now`;

    let blockedUntil = row.blocked_until;
    if ((!blockedUntil || blockedUntil <= row.db_now) && row.hits > limit) {
      // Over the limit: block, and keep the window open until the block ends
      // so the counter restarts afterwards.
      const [blocked] = await this.prisma.$queryRaw<Row[]>`
        UPDATE api_rate_limit SET
          blocked_until = now() + make_interval(secs => ${blockDuration}::float8 / 1000),
          expires_at = GREATEST(expires_at, now() + make_interval(secs => ${blockDuration}::float8 / 1000))
        WHERE key = ${key}
        RETURNING hits, expires_at, blocked_until, now() AS db_now`;
      blockedUntil = blocked.blocked_until;
    }

    this.maybeCleanUp();

    const now = row.db_now.getTime();
    const isBlocked = !!blockedUntil && blockedUntil.getTime() > now;
    return {
      totalHits: row.hits,
      timeToExpire: Math.max(0, Math.ceil((row.expires_at.getTime() - now) / 1000)),
      isBlocked,
      timeToBlockExpire: isBlocked
        ? Math.ceil((blockedUntil!.getTime() - now) / 1000)
        : 0,
    };
  }

  /** Roughly every 100 requests, drop windows that ended over an hour ago. */
  private maybeCleanUp() {
    if (Math.random() >= 0.01) return;
    this.prisma.$executeRaw`
      DELETE FROM api_rate_limit
      WHERE expires_at < now() - interval '1 hour'
        AND (blocked_until IS NULL OR blocked_until < now())`.catch(() => {
      // Best effort: the next cleanup will catch up.
    });
  }
}
