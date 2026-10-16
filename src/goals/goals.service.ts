import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient, type SavingsGoal } from '../generated/prisma/client.js';
import { parseISODate, toISODate } from '../common/dates.js';
import type { GoalInput, GoalPatch } from './goals.schemas.js';

/** API shape — matches the frontend's `SavingsGoal` type. */
export interface GoalDto {
  id: string;
  name: string;
  target: number;
  current: number;
  monthlyContribution: number;
  annualRate: number;
  deadline?: string;
}

export function toGoalDto(g: SavingsGoal): GoalDto {
  return {
    id: g.id,
    name: g.name,
    target: g.target,
    current: g.current,
    monthlyContribution: g.monthlyContribution,
    annualRate: g.annualRate,
    ...(g.deadline ? { deadline: toISODate(g.deadline) } : {}),
  };
}

function deadlineValue(deadline: string | null | undefined) {
  if (deadline === undefined) return undefined;
  return deadline === null ? null : parseISODate(deadline);
}

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string) {
    const rows = await this.prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toGoalDto);
  }

  async get(userId: string, id: string) {
    return toGoalDto(await this.findOwned(userId, id));
  }

  async create(userId: string, input: GoalInput) {
    const row = await this.prisma.savingsGoal.create({
      data: { ...input, userId, deadline: deadlineValue(input.deadline) },
    });
    return toGoalDto(row);
  }

  async update(userId: string, id: string, patch: GoalPatch) {
    await this.findOwned(userId, id);
    const row = await this.prisma.savingsGoal.update({
      where: { id },
      data: { ...patch, deadline: deadlineValue(patch.deadline) },
    });
    return toGoalDto(row);
  }

  /** Contributions to the goal are kept as plain expenses (goalId set to null). */
  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.savingsGoal.delete({ where: { id } });
  }

  private async findOwned(userId: string, id: string) {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id, userId },
    });
    if (!goal) throw new NotFoundException('Savings goal not found');
    return goal;
  }
}
