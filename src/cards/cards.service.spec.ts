import { describe, expect, it, vi } from 'vitest';
import { cardInput, cardPatch, purchaseInput, purchasePatch } from './cards.schemas.js';
import { CardsService } from './cards.service.js';

const card = {
  id: 'c1',
  userId: 'u1',
  name: 'Signature',
  institution: 'banco-chile',
  creditLimit: 3_000_000,
  closingDay: 25,
  paymentDay: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
  purchases: [] as object[],
};

const purchase = {
  id: 'p1',
  cardId: 'c1',
  description: 'Notebook',
  amount: 600_000,
  installments: 6,
  monthlyRate: 0,
  date: new Date('2026-10-20T00:00:00Z'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup({ owned = true } = {}) {
  const prisma = {
    creditCard: {
      findFirst: vi.fn().mockResolvedValue(owned ? card : null),
      findMany: vi.fn().mockResolvedValue([{ ...card, purchases: [purchase] }]),
      create: vi.fn().mockImplementation(({ data }) => ({
        ...card,
        ...data,
        institution: data.institution ?? null,
        purchases: [],
      })),
      update: vi.fn().mockImplementation(({ data }) => ({ ...card, ...data })),
      delete: vi.fn().mockResolvedValue(card),
    },
    creditCardPurchase: {
      findFirst: vi.fn().mockResolvedValue(owned ? { id: 'p1' } : null),
      create: vi.fn().mockImplementation(({ data }) => ({ ...purchase, ...data, id: 'p2' })),
      update: vi.fn().mockImplementation(({ data }) => ({
        ...purchase,
        ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
      })),
      delete: vi.fn().mockResolvedValue(purchase),
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new CardsService(prisma as any), prisma };
}

describe('card schemas (T15)', () => {
  it('requires a positive limit and days within the month', () => {
    expect(cardInput.safeParse({ name: 'X', creditLimit: 0, closingDay: 1, paymentDay: 5 }).success).toBe(false);
    expect(cardInput.safeParse({ name: 'X', creditLimit: 1, closingDay: 32, paymentDay: 5 }).success).toBe(false);
    expect(cardInput.safeParse({ name: 'X', creditLimit: 1, closingDay: 31, paymentDay: 1 }).success).toBe(true);
  });

  it('only accepts known institutions and lets a patch clear it', () => {
    expect(cardInput.safeParse({ ...card, institution: 'banco-falso' }).success).toBe(false);
    expect(cardPatch.parse({ institution: null })).toEqual({ institution: null });
  });

  it('defaults the purchase rate to 0 and caps installments and rate', () => {
    const base = { description: 'TV', amount: 100_000, installments: 12, date: '2026-10-27' };
    expect(purchaseInput.parse(base).monthlyRate).toBe(0);
    expect(purchaseInput.safeParse({ ...base, installments: 61 }).success).toBe(false);
    expect(purchaseInput.safeParse({ ...base, installments: 0 }).success).toBe(false);
    expect(purchaseInput.safeParse({ ...base, monthlyRate: 25 }).success).toBe(false);
    expect(purchaseInput.safeParse({ ...base, monthlyRate: 1.5 }).success).toBe(true);
  });

  it('a partial purchase patch does not reset the rate', () => {
    expect(purchasePatch.parse({ installments: 3 })).toEqual({ installments: 3 });
  });
});

describe('CardsService (T15)', () => {
  it('lists cards with their purchases as DTOs', async () => {
    const { service } = setup();
    const [dto] = await service.list('u1');
    expect(dto).toMatchObject({ id: 'c1', institution: 'banco-chile', creditLimit: 3_000_000 });
    expect(dto.purchases).toEqual([
      {
        id: 'p1',
        cardId: 'c1',
        description: 'Notebook',
        amount: 600_000,
        installments: 6,
        monthlyRate: 0,
        date: '2026-10-20',
      },
    ]);
  });

  it('omits the institution from the DTO when not set', async () => {
    const { service } = setup();
    const dto = await service.create('u1', cardInput.parse({ name: 'X', creditLimit: 1, closingDay: 1, paymentDay: 5 }));
    expect('institution' in dto).toBe(false);
  });

  it('answers 404 for a card of another user', async () => {
    const { service, prisma } = setup({ owned: false });
    await expect(service.get('u1', 'c1')).rejects.toThrow('Credit card not found');
    await expect(service.remove('u1', 'c1')).rejects.toThrow('Credit card not found');
    expect(prisma.creditCard.delete).not.toHaveBeenCalled();
  });

  it('stores a purchase with its date and card', async () => {
    const { service, prisma } = setup();
    const dto = await service.addPurchase(
      'u1',
      'c1',
      purchaseInput.parse({ description: 'TV', amount: 300_000, installments: 3, date: '2026-10-27' }),
    );
    expect(prisma.creditCardPurchase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cardId: 'c1', date: new Date('2026-10-27T00:00:00.000Z') }),
    });
    expect(dto.date).toBe('2026-10-27');
  });

  it('refuses to touch a purchase that is not on one of the user cards', async () => {
    const { service, prisma } = setup({ owned: false });
    await expect(service.updatePurchase('u1', 'c1', 'p1', { amount: 1 })).rejects.toThrow('Purchase not found');
    await expect(service.removePurchase('u1', 'c1', 'p1')).rejects.toThrow('Purchase not found');
    expect(prisma.creditCardPurchase.update).not.toHaveBeenCalled();
    expect(prisma.creditCardPurchase.delete).not.toHaveBeenCalled();
    expect(prisma.creditCardPurchase.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', cardId: 'c1', card: { userId: 'u1' } } }),
    );
  });

  it('a partial purchase patch keeps the stored fields', async () => {
    const { service } = setup();
    const dto = await service.updatePurchase('u1', 'c1', 'p1', { installments: 12 });
    expect(dto).toMatchObject({ installments: 12, amount: 600_000, date: '2026-10-20' });
  });
});
