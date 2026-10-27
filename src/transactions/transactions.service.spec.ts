import { describe, expect, it, vi } from 'vitest';
import { transactionInput } from './transactions.schemas.js';
import {
  goalDelta,
  TransactionsService,
  WITHDRAWAL_EXCEEDS_SAVED,
} from './transactions.service.js';

const base = {
  id: 't1',
  userId: 'u1',
  type: 'expense' as const,
  amount: 100_000,
  category: 'Ahorro',
  description: 'Aporte',
  date: new Date('2026-10-27T00:00:00Z'),
  source: null,
  salaryMonth: null,
  goalId: 'g1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Prisma mock: `$transaction` runs the callback with the same client. */
function setup({ saved = 100_000, prev = base }: { saved?: number; prev?: object | null } = {}) {
  const deltas: number[] = [];
  const tx = {
    transaction: {
      findFirst: vi.fn().mockResolvedValue(prev),
      create: vi.fn().mockImplementation(({ data }) => ({ ...base, ...data, id: 't2' })),
      // Like Prisma: undefined fields in `data` keep their stored value.
      update: vi.fn().mockImplementation(({ data }) => ({
        ...base,
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
      })),
      delete: vi.fn().mockResolvedValue(base),
    },
    savingsGoal: {
      findFirst: vi.fn().mockResolvedValue(saved === null ? null : { current: saved }),
    },
    // Tagged template: the first value is the delta, the second the goal id.
    $executeRaw: vi.fn().mockImplementation((_s: TemplateStringsArray, delta: number) => {
      deltas.push(delta);
      return Promise.resolve(1);
    }),
  };
  const prisma = { ...tx, $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  const salary = { reconcile: vi.fn() };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new TransactionsService(prisma as any, salary as any);
  return { service, tx, deltas };
}

const withdrawal = transactionInput.parse({
  type: 'income',
  amount: 30_000,
  category: 'Ahorro',
  date: '2026-10-27',
  goalId: 'g1',
});

describe('goal contributions and withdrawals (T16)', () => {
  it('an expense adds to the goal, an income subtracts', () => {
    expect(goalDelta('expense', 500)).toBe(500);
    expect(goalDelta('income', 500)).toBe(-500);
  });

  it('a contribution still adds its amount to the goal', async () => {
    const { service, deltas } = setup();
    await service.create('u1', { ...withdrawal, type: 'expense', amount: 20_000 });
    expect(deltas).toEqual([20_000]);
  });

  it('a withdrawal subtracts its amount from the goal', async () => {
    const { service, deltas } = setup();
    const dto = await service.create('u1', withdrawal);
    expect(deltas).toEqual([-30_000]);
    expect(dto.type).toBe('income');
    expect(dto.goalId).toBe('g1');
  });

  it('rejects a withdrawal larger than what is saved', async () => {
    const { service, deltas, tx } = setup({ saved: 20_000 });
    await expect(service.create('u1', withdrawal)).rejects.toThrow(WITHDRAWAL_EXCEEDS_SAVED);
    expect(tx.transaction.create).not.toHaveBeenCalled();
    expect(deltas).toEqual([]);
  });

  it('allows withdrawing exactly what is saved', async () => {
    const { service, deltas } = setup({ saved: 30_000 });
    await service.create('u1', withdrawal);
    expect(deltas).toEqual([-30_000]);
  });

  it('rejects a goal of another user', async () => {
    const { service } = setup({ saved: null as unknown as number });
    await expect(service.create('u1', withdrawal)).rejects.toThrow('Savings goal not found');
  });

  it('turning a contribution into a withdrawal reverts and re-applies on the goal', async () => {
    // Saved 200.000 includes the 100.000 contribution being edited.
    const { service, deltas } = setup({ saved: 200_000 });
    await service.update('u1', 't1', { type: 'income', amount: 60_000 });
    expect(deltas).toEqual([-100_000, -60_000]);
  });

  it('rejects an edit that would leave the goal negative', async () => {
    // Saved 100.000 (the contribution) -> revert it (0) -> withdraw 1 = negative.
    const { service } = setup({ saved: 100_000 });
    await expect(service.update('u1', 't1', { type: 'income', amount: 1 })).rejects.toThrow(
      WITHDRAWAL_EXCEEDS_SAVED,
    );
  });

  it('deleting a withdrawal gives the amount back to the goal', async () => {
    const { service, deltas } = setup({ prev: { ...base, type: 'income', amount: 30_000 } });
    await service.remove('u1', 't1');
    expect(deltas).toEqual([30_000]);
  });

  it('deleting a contribution takes it out of the goal', async () => {
    const { service, deltas } = setup();
    await service.remove('u1', 't1');
    expect(deltas).toEqual([-100_000]);
  });
});
