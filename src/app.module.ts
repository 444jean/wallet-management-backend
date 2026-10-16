import { Module } from '@nestjs/common';
import { AuthModule } from '@thallesp/nestjs-better-auth';
import { AppController } from './app.controller.js';
import { auth } from './auth/auth.js';
import { FinanceModule } from './finance/finance.module.js';
import { GoalsModule } from './goals/goals.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SalaryModule } from './salary/salary.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';

@Module({
  imports: [
    PrismaModule,
    // Registers /api/auth/* and a global guard: every route requires a
    // session unless marked with @AllowAnonymous().
    AuthModule.forRoot({ auth }),
    TransactionsModule,
    GoalsModule,
    SalaryModule,
    FinanceModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
