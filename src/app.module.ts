import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import type { Request } from 'express';
import { AppController } from './app.controller.js';
import { auth } from './auth/auth.js';
import { PrismaThrottlerStorage } from './common/prisma-throttler.storage.js';
import { env } from './config/env.js';
import { FinanceModule } from './finance/finance.module.js';
import { GoalsModule } from './goals/goals.module.js';
import { prisma } from './prisma/prisma.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SalaryModule } from './salary/salary.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

/** JSON and form bodies above this size get a 413 (the localStorage import fits). */
export const BODY_LIMIT = '1mb';

@Module({
  imports: [
    PrismaModule,
    // Registers /api/auth/* and a global guard: every route requires a
    // session unless marked with @AllowAnonymous().
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: BODY_LIMIT },
        urlencoded: { limit: BODY_LIMIT },
      },
    }),
    // Global per-IP limit for the wallet API (T03), stored in Postgres so it
    // holds across instances. /api/auth/* has Better Auth's own limit (T02).
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'api', ttl: 60_000, limit: env.API_RATE_LIMIT }],
      storage: new PrismaThrottlerStorage(prisma),
      skipIf: (ctx) =>
        (ctx.switchToHttp().getRequest<Request>().originalUrl ?? '').startsWith(
          '/api/auth/',
        ),
      errorMessage: 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.',
    }),
    TransactionsModule,
    GoalsModule,
    SalaryModule,
    FinanceModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
