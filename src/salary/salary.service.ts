import { Injectable } from '@nestjs/common';
import { PrismaClient, type SalaryConfig } from '../generated/prisma/client.js';
import { currentMonthKey, daysInMonth, parseISODate } from '../common/dates.js';
import type { SalaryInput } from './salary.schemas.js';

/** How many months back (including the current one) salaries are generated. */
const MAX_MONTHS_BACK = 24;

export interface SalaryDto {
  amount: number;
  category: string;
  description: string;
  day: number;
  since: string;
}

function toSalaryDto(s: SalaryConfig): SalaryDto {
  return {
    amount: s.amount,
    category: s.category,
    description: s.description,
    day: s.day,
    since: s.since,
  };
}

function monthSerial(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return y * 12 + (m - 1);
}

function serialToKey(serial: number): string {
  const y = Math.floor(serial / 12);
  const m = (serial % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

@Injectable()
export class SalaryService {
  constructor(private readonly prisma: PrismaClient) {}

  async get(userId: string): Promise<SalaryDto | null> {
    const config = await this.prisma.salaryConfig.findUnique({
      where: { userId },
    });
    return config ? toSalaryDto(config) : null;
  }

  async set(userId: string, input: SalaryInput): Promise<SalaryDto> {
    const config = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.salaryConfig.upsert({
        where: { userId },
        create: { userId, ...input },
        update: input,
      });

      // Update the salary already generated for the current month so the edit
      // shows up right away; past months stay as history.
      await tx.transaction.updateMany({
        where: { userId, salaryMonth: currentMonthKey() },
        data: {
          amount: input.amount,
          category: input.category,
          description: input.description,
        },
      });
      return saved;
    });

    await this.reconcile(userId);
    return toSalaryDto(config);
  }

  /** Stops generating new salaries; already generated ones are kept. */
  async clear(userId: string): Promise<void> {
    await this.prisma.salaryConfig.deleteMany({ where: { userId } });
  }

  /**
   * Creates the missing salary income for every month from `since` up to the
   * current month (at most MAX_MONTHS_BACK months). Idempotent: the unique
   * (userId, salaryMonth) index makes concurrent calls safe.
   */
  async reconcile(userId: string): Promise<void> {
    const config = await this.prisma.salaryConfig.findUnique({
      where: { userId },
    });
    if (!config) return;

    const current = monthSerial(currentMonthKey());
    const start = Math.max(
      monthSerial(config.since),
      current - (MAX_MONTHS_BACK - 1),
    );
    if (start > current) return;

    const data = [];
    for (let serial = start; serial <= current; serial++) {
      const key = serialToKey(serial);
      const [y, m] = key.split('-').map(Number);
      const day = Math.min(config.day, daysInMonth(y, m));
      data.push({
        userId,
        type: 'income' as const,
        amount: config.amount,
        category: config.category,
        description: config.description,
        date: parseISODate(`${key}-${String(day).padStart(2, '0')}`),
        source: 'salary' as const,
        salaryMonth: key,
      });
    }

    await this.prisma.transaction.createMany({ data, skipDuplicates: true });
  }
}
