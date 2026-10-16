import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { parseISODate } from '../common/dates.js';
import { SalaryService } from '../salary/salary.service.js';
import { toTransactionDto } from './transaction.mapper.js';
import type {
  TransactionFilters,
  TransactionInput,
  TransactionPatch,
} from './transactions.schemas.js';

type Tx = Prisma.TransactionClient;

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly salary: SalaryService,
  ) {}

  async list(userId: string, filters: TransactionFilters) {
    await this.salary.reconcile(userId);

    const rows = await this.prisma.transaction.findMany({
      where: {
        userId,
        type: filters.type,
        category: filters.category,
        goalId: filters.goalId,
        date: {
          gte: filters.from ? parseISODate(filters.from) : undefined,
          lte: filters.to ? parseISODate(filters.to) : undefined,
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toTransactionDto);
  }

  async get(userId: string, id: string) {
    return toTransactionDto(await this.findOwned(this.prisma, userId, id));
  }

  async create(userId: string, input: TransactionInput) {
    const goalId = input.goalId ?? null;
    this.assertGoalContributionIsExpense(input.type, goalId);

    const created = await this.prisma.$transaction(async (tx) => {
      if (goalId) await this.assertGoalOwned(tx, userId, goalId);

      const row = await tx.transaction.create({
        data: {
          userId,
          type: input.type,
          amount: input.amount,
          category: input.category,
          description: input.description,
          date: parseISODate(input.date),
          goalId,
        },
      });
      if (goalId) await this.adjustGoalCurrent(tx, goalId, row.amount);
      return row;
    });
    return toTransactionDto(created);
  }

  async update(userId: string, id: string, patch: TransactionPatch) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const prev = await this.findOwned(tx, userId, id);

      const type = patch.type ?? prev.type;
      const amount = patch.amount ?? prev.amount;
      const goalId = patch.goalId === undefined ? prev.goalId : patch.goalId;
      this.assertGoalContributionIsExpense(type, goalId);
      if (goalId && goalId !== prev.goalId) {
        await this.assertGoalOwned(tx, userId, goalId);
      }

      const row = await tx.transaction.update({
        where: { id },
        data: {
          type,
          amount,
          category: patch.category,
          description: patch.description,
          date: patch.date ? parseISODate(patch.date) : undefined,
          goalId,
        },
      });

      // Revert the previous contribution (if any) and apply the new one.
      if (prev.goalId)
        await this.adjustGoalCurrent(tx, prev.goalId, -prev.amount);
      if (goalId) await this.adjustGoalCurrent(tx, goalId, amount);
      return row;
    });
    return toTransactionDto(updated);
  }

  async remove(userId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const prev = await this.findOwned(tx, userId, id);
      await tx.transaction.delete({ where: { id } });
      if (prev.goalId)
        await this.adjustGoalCurrent(tx, prev.goalId, -prev.amount);
    });
  }

  private async findOwned(db: Tx | PrismaClient, userId: string, id: string) {
    const row = await db.transaction.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Transaction not found');
    return row;
  }

  private async assertGoalOwned(tx: Tx, userId: string, goalId: string) {
    const goal = await tx.savingsGoal.findFirst({
      where: { id: goalId, userId },
      select: { id: true },
    });
    if (!goal) throw new BadRequestException('Savings goal not found');
  }

  private assertGoalContributionIsExpense(type: string, goalId: string | null) {
    if (goalId && type !== 'expense') {
      throw new BadRequestException('Goal contributions must be expenses');
    }
  }

  /** goal.current += delta, never going below 0. */
  private async adjustGoalCurrent(tx: Tx, goalId: string, delta: number) {
    await tx.$executeRaw`
      UPDATE "savings_goals"
      SET "current" = GREATEST(0, "current" + ${delta}), "updatedAt" = now()
      WHERE "id" = ${goalId}`;
  }
}
