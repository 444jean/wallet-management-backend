import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller.js';
import { auth } from './auth/auth.js';
import { AvatarModule } from './avatar/avatar.module.js';
import { ApiRateLimitGuard } from './common/api-rate-limit.guard.js';
import { FinanceModule } from './finance/finance.module.js';
import { GoalsModule } from './goals/goals.module.js';
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
    TransactionsModule,
    GoalsModule,
    SalaryModule,
    FinanceModule,
    AvatarModule,
  ],
  controllers: [AppController],
  // Global per-IP limit for the wallet API (T03).
  providers: [{ provide: APP_GUARD, useClass: ApiRateLimitGuard }],
})
export class AppModule {}
