import { describe, expect, it, vi } from 'vitest';
import { goalInput, goalPatch } from './goals.schemas.js';
import { GoalsService } from './goals.service.js';

const stored = {
  id: 'g1',
  userId: 'u1',
  name: 'Viaje',
  target: 1_000_000,
  current: 100_000,
  monthlyContribution: 50_000,
  annualRate: 0,
  deadline: new Date('2027-01-01T00:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup(goal: object = stored) {
  const prisma = {
    savingsGoal: {
      findFirst: vi.fn().mockResolvedValue(goal),
      update: vi.fn().mockImplementation(({ data }) => ({ ...goal, ...data })),
      // Like Postgres: omitted nullable columns come back as null.
      create: vi.fn().mockImplementation(({ data }) => ({
        ...stored,
        ...data,
        target: data.target ?? null,
        deadline: data.deadline ?? null,
        institution: data.institution ?? null,
      })),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new GoalsService(prisma as any), prisma };
}

describe('goal schemas (T10: Fondo)', () => {
  it('accepts a goal without target and defaults the contribution to 0', () => {
    const parsed = goalInput.parse({ name: 'Fondo de emergencia' });
    expect(parsed.target).toBeUndefined();
    expect(parsed.monthlyContribution).toBe(0);
  });

  it('rejects a deadline without target', () => {
    const res = goalInput.safeParse({ name: 'Fondo', deadline: '2027-01-01' });
    expect(res.success).toBe(false);
  });

  it('still rejects a target of 0 (no target is null, not 0)', () => {
    expect(goalInput.safeParse({ name: 'Meta', target: 0 }).success).toBe(false);
  });

  it('lets a patch remove the target with null', () => {
    expect(goalPatch.parse({ target: null }).target).toBeNull();
  });

  it('a partial patch does not reset the omitted amounts', () => {
    expect(goalPatch.parse({ target: null })).toEqual({ target: null });
  });
});

describe('goal institution (T11)', () => {
  it('accepts a known institution code', () => {
    expect(goalInput.parse({ name: 'Fondo', institution: 'mercado-pago' }).institution).toBe(
      'mercado-pago',
    );
  });

  it('rejects an unknown institution', () => {
    expect(goalInput.safeParse({ name: 'Fondo', institution: 'banco-falso' }).success).toBe(false);
  });

  it('lets a patch remove the institution with null', () => {
    expect(goalPatch.parse({ institution: null })).toEqual({ institution: null });
  });

  it('includes the institution in the DTO only when set', async () => {
    const { service } = setup();
    const withIt = await service.create('u1', goalInput.parse({ name: 'A', institution: 'mach' }));
    const without = await service.create('u1', goalInput.parse({ name: 'B' }));
    expect(withIt.institution).toBe('mach');
    expect('institution' in without).toBe(false);
  });
});

describe('GoalsService (T10: Fondo)', () => {
  it('returns target null for a Fondo', async () => {
    const { service } = setup();
    const dto = await service.create('u1', goalInput.parse({ name: 'Fondo' }));
    expect(dto.target).toBeNull();
    expect(dto.deadline).toBeUndefined();
  });

  it('removing the target also clears the deadline', async () => {
    const { service, prisma } = setup();
    const dto = await service.update('u1', 'g1', { target: null });
    expect(prisma.savingsGoal.update.mock.calls[0][0].data.deadline).toBeNull();
    expect(dto.target).toBeNull();
  });

  it('rejects setting a deadline on a stored Fondo', async () => {
    const { service, prisma } = setup({ ...stored, target: null, deadline: null });
    await expect(service.update('u1', 'g1', { deadline: '2027-06-01' })).rejects.toThrow(
      /fecha límite/,
    );
    expect(prisma.savingsGoal.update).not.toHaveBeenCalled();
  });

  it('keeps the deadline when only other fields change', async () => {
    const { service, prisma } = setup();
    await service.update('u1', 'g1', { name: 'Viaje a Japón' });
    expect(prisma.savingsGoal.update.mock.calls[0][0].data.deadline).toBeUndefined();
  });
});
