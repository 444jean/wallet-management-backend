import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: { APP_TIMEZONE: 'America/Santiago' },
}));

const { SalaryService } = await import('./salary.service.js');

function setup(config: object | null) {
  const prisma = {
    salaryConfig: { findUnique: vi.fn().mockResolvedValue(config) },
    transaction: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new SalaryService(prisma as any);
  const generated = () =>
    (prisma.transaction.createMany.mock.calls[0]?.[0]?.data ?? []) as {
      date: Date;
      salaryMonth: string;
    }[];
  return { service, prisma, generated };
}

const base = {
  userId: 'u1',
  amount: 1_000_000,
  category: 'Sueldo',
  description: 'Sueldo',
};

describe('SalaryService.reconcile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('does nothing without a salary config', async () => {
    const { service, prisma } = setup(null);
    await service.reconcile('u1');
    expect(prisma.transaction.createMany).not.toHaveBeenCalled();
  });

  it('generates one salary per month up to the current one, capping the day', async () => {
    const { service, prisma, generated } = setup({
      ...base,
      day: 31,
      since: '2026-08',
    });
    await service.reconcile('u1');

    expect(prisma.transaction.createMany.mock.calls[0][0].skipDuplicates).toBe(
      true,
    );
    expect(generated().map((t) => t.date.toISOString().slice(0, 10))).toEqual([
      '2026-08-31',
      '2026-09-30',
      '2026-10-31',
    ]);
    expect(generated().map((t) => t.salaryMonth)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  it('looks back at most 24 months', async () => {
    const { service, generated } = setup({ ...base, day: 1, since: '2020-01' });
    await service.reconcile('u1');
    expect(generated()).toHaveLength(24);
    expect(generated()[0].salaryMonth).toBe('2024-11');
  });

  it('skips a start month in the future', async () => {
    const { service, prisma } = setup({ ...base, day: 1, since: '2027-01' });
    await service.reconcile('u1');
    expect(prisma.transaction.createMany).not.toHaveBeenCalled();
  });
});
