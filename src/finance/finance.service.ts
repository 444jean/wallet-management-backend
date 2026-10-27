import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { CARD_INCLUDE, toCardDto } from '../cards/cards.service.js';
import { parseISODate } from '../common/dates.js';
import { toGoalDto } from '../goals/goals.service.js';
import { SalaryService } from '../salary/salary.service.js';
import { toTransactionDto } from '../transactions/transaction.mapper.js';
import type { FinanceImport } from './finance.schemas.js';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly salary: SalaryService,
  ) {}

  /** Everything the frontend needs in one call (same shape as `FinanceData`). */
  async snapshot(userId: string) {
    await this.salary.reconcile(userId);

    const [transactions, goals, salary, cards] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.savingsGoal.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      }),
      this.salary.get(userId),
      this.prisma.creditCard.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        include: CARD_INCLUDE,
      }),
    ]);

    return {
      transactions: transactions.map(toTransactionDto),
      goals: goals.map(toGoalDto),
      salary,
      cards: cards.map(toCardDto),
    };
  }

  async import(userId: string, data: FinanceImport) {
    await this.prisma.$transaction(
      async (tx) => {
        if (!data.replace && (await this.hasData(tx, userId))) {
          throw new ConflictException(
            'Account already has data; send "replace": true to overwrite it',
          );
        }
        await this.deleteAll(tx, userId);

        // Goal ids are regenerated; map the client ids so contributions keep
        // pointing at the right goal. `current` is imported as-is because it
        // already includes those contributions.
        const goalIds = new Map<string, string>();
        for (const { id: clientId, deadline, ...goal } of data.goals) {
          const created = await tx.savingsGoal.create({
            data: {
              ...goal,
              userId,
              deadline: deadline ? parseISODate(deadline) : null,
            },
            select: { id: true },
          });
          goalIds.set(clientId, created.id);
        }

        const salaryMonths = new Set<string>();
        await tx.transaction.createMany({
          data: data.transactions.map((t) => {
            const month = t.date.slice(0, 7);
            // Only one auto-generated salary per month can be tracked as such.
            const isSalary = t.source === 'salary' && !salaryMonths.has(month);
            if (isSalary) salaryMonths.add(month);
            const goalId = t.goalId ? (goalIds.get(t.goalId) ?? null) : null;
            return {
              userId,
              type: t.type,
              amount: t.amount,
              category: t.category,
              description: t.description,
              date: parseISODate(t.date),
              source: isSalary ? ('salary' as const) : null,
              salaryMonth: isSalary ? month : null,
              goalId,
            };
          }),
        });

        if (data.salary) {
          await tx.salaryConfig.create({ data: { userId, ...data.salary } });
        }
      },
      { timeout: 30_000 },
    );

    return this.snapshot(userId);
  }

  async reset(userId: string) {
    await this.prisma.$transaction((tx) => this.deleteAll(tx, userId));
  }

  private async hasData(tx: Prisma.TransactionClient, userId: string) {
    const [t, g, s, c] = await Promise.all([
      tx.transaction.count({ where: { userId } }),
      tx.savingsGoal.count({ where: { userId } }),
      tx.salaryConfig.count({ where: { userId } }),
      tx.creditCard.count({ where: { userId } }),
    ]);
    return t + g + s + c > 0;
  }

  private async deleteAll(tx: Prisma.TransactionClient, userId: string) {
    await tx.transaction.deleteMany({ where: { userId } });
    await tx.savingsGoal.deleteMany({ where: { userId } });
    await tx.salaryConfig.deleteMany({ where: { userId } });
    // Purchases go with their cards (ON DELETE CASCADE).
    await tx.creditCard.deleteMany({ where: { userId } });
  }
}
