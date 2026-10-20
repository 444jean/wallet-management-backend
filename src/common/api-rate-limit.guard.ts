import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../prisma/prisma.js';
import { PrismaRateLimitStorage } from './prisma-rate-limit.storage.js';

const NAME = 'api';
const TTL_MS = 60_000;
const MESSAGE = 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.';

/**
 * Global per-IP and per-route limit for the wallet API (T03), stored in
 * Postgres so it holds across instances. /api/auth/* has Better Auth's own
 * limit (T02). Replaces @nestjs/throttler, which is CommonJS and requires the
 * ESM-only @nestjs/common 12: Vercel's runtime cannot load that (T05).
 * Same key, headers and 429 as the ThrottlerGuard it replaces.
 */
@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  private readonly storage = new PrismaRateLimitStorage(prisma);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    if ((req.originalUrl ?? '').startsWith('/api/auth/')) return true;

    const limit = env.API_RATE_LIMIT;
    // req.ip honours TRUST_PROXY (app.setup.ts).
    const key = createHash('sha256')
      .update(
        `${context.getClass().name}-${context.getHandler().name}-${NAME}-${req.ip ?? ''}`,
      )
      .digest('hex');
    const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
      await this.storage.increment(key, TTL_MS, limit, TTL_MS);

    if (isBlocked) {
      res.setHeader(`Retry-After-${NAME}`, timeToBlockExpire);
      throw new HttpException(MESSAGE, HttpStatus.TOO_MANY_REQUESTS);
    }
    res.setHeader(`X-RateLimit-Limit-${NAME}`, limit);
    res.setHeader(`X-RateLimit-Remaining-${NAME}`, Math.max(0, limit - totalHits));
    res.setHeader(`X-RateLimit-Reset-${NAME}`, timeToExpire);
    return true;
  }
}
