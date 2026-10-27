import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PrismaClient,
  type CreditCard,
  type CreditCardPurchase,
  type Prisma,
} from '../generated/prisma/client.js';
import { parseISODate, toISODate } from '../common/dates.js';
import type {
  CardInput,
  CardPatch,
  PurchaseInput,
  PurchasePatch,
} from './cards.schemas.js';

/** API shape — matches the frontend's `CardPurchase` type. */
export interface CardPurchaseDto {
  id: string;
  cardId: string;
  description: string;
  amount: number;
  installments: number;
  monthlyRate: number;
  date: string;
}

/** API shape — matches the frontend's `CreditCard` type. */
export interface CreditCardDto {
  id: string;
  name: string;
  institution?: string;
  creditLimit: number;
  closingDay: number;
  paymentDay: number;
  purchases: CardPurchaseDto[];
}

export function toPurchaseDto(p: CreditCardPurchase): CardPurchaseDto {
  return {
    id: p.id,
    cardId: p.cardId,
    description: p.description,
    amount: p.amount,
    installments: p.installments,
    monthlyRate: p.monthlyRate,
    date: toISODate(p.date),
  };
}

export function toCardDto(
  c: CreditCard & { purchases: CreditCardPurchase[] },
): CreditCardDto {
  return {
    id: c.id,
    name: c.name,
    ...(c.institution ? { institution: c.institution } : {}),
    creditLimit: c.creditLimit,
    closingDay: c.closingDay,
    paymentDay: c.paymentDay,
    purchases: c.purchases.map(toPurchaseDto),
  };
}

/** Newest purchases first; cards in creation order. */
export const CARD_INCLUDE = {
  purchases: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] },
} satisfies Prisma.CreditCardInclude;

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string) {
    const rows = await this.prisma.creditCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: CARD_INCLUDE,
    });
    return rows.map(toCardDto);
  }

  async get(userId: string, id: string) {
    return toCardDto(await this.findOwned(userId, id));
  }

  async create(userId: string, input: CardInput) {
    const row = await this.prisma.creditCard.create({
      data: { ...input, userId },
      include: CARD_INCLUDE,
    });
    return toCardDto(row);
  }

  async update(userId: string, id: string, patch: CardPatch) {
    await this.findOwned(userId, id);
    const row = await this.prisma.creditCard.update({
      where: { id },
      data: patch,
      include: CARD_INCLUDE,
    });
    return toCardDto(row);
  }

  /** Its purchases go with it (ON DELETE CASCADE). */
  async remove(userId: string, id: string) {
    await this.findOwned(userId, id);
    await this.prisma.creditCard.delete({ where: { id } });
  }

  async addPurchase(userId: string, cardId: string, input: PurchaseInput) {
    await this.findOwned(userId, cardId);
    const row = await this.prisma.creditCardPurchase.create({
      data: { ...input, cardId, date: parseISODate(input.date) },
    });
    return toPurchaseDto(row);
  }

  async updatePurchase(
    userId: string,
    cardId: string,
    purchaseId: string,
    patch: PurchasePatch,
  ) {
    await this.findOwnedPurchase(userId, cardId, purchaseId);
    const row = await this.prisma.creditCardPurchase.update({
      where: { id: purchaseId },
      data: {
        ...patch,
        date: patch.date ? parseISODate(patch.date) : undefined,
      },
    });
    return toPurchaseDto(row);
  }

  async removePurchase(userId: string, cardId: string, purchaseId: string) {
    await this.findOwnedPurchase(userId, cardId, purchaseId);
    await this.prisma.creditCardPurchase.delete({ where: { id: purchaseId } });
  }

  private async findOwned(userId: string, id: string) {
    const card = await this.prisma.creditCard.findFirst({
      where: { id, userId },
      include: CARD_INCLUDE,
    });
    if (!card) throw new NotFoundException('Credit card not found');
    return card;
  }

  private async findOwnedPurchase(
    userId: string,
    cardId: string,
    purchaseId: string,
  ) {
    const purchase = await this.prisma.creditCardPurchase.findFirst({
      where: { id: purchaseId, cardId, card: { userId } },
      select: { id: true },
    });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }
}
