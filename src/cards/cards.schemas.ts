import { z } from 'zod';
import { isoDate, positiveMoney } from '../common/schemas.js';
import { INSTITUTIONS } from '../goals/institutions.js';

/** Day of the month (the frontend caps it to the month's last day). */
const dayOfMonth = z.number().int().min(1).max(31);

/** A credit card (T15): limit and billing days; the math lives in the frontend. */
const cardShape = z.object({
  name: z.string().trim().min(1).max(100),
  /** Issuing bank, a code from goals/institutions.ts. */
  institution: z.enum(INSTITUTIONS).nullish(),
  /** Total credit limit ("cupo"). */
  creditLimit: positiveMoney,
  /** Statement closing day. */
  closingDay: dayOfMonth,
  /** Payment due day. */
  paymentDay: dayOfMonth,
});

export const cardInput = cardShape;
export type CardInput = z.infer<typeof cardInput>;

export const cardPatch = cardShape.partial();
export type CardPatch = z.infer<typeof cardPatch>;

export const MAX_INSTALLMENTS = 60;
/** Monthly interest cap, in percent (Chilean cards sit well below this). */
export const MAX_MONTHLY_RATE = 20;

/** A purchase paid in installments; "amount" is the price, before interest. */
const purchaseShape = z.object({
  description: z.string().trim().min(1).max(200),
  amount: positiveMoney,
  installments: z.number().int().min(1).max(MAX_INSTALLMENTS),
  /** Monthly interest rate in percent; 0 = interest-free installments. */
  monthlyRate: z.number().min(0).max(MAX_MONTHLY_RATE),
  /** Purchase date; with the card's closing day it decides the first charge. */
  date: isoDate,
});

export const purchaseInput = purchaseShape.extend({
  monthlyRate: purchaseShape.shape.monthlyRate.default(0),
});
export type PurchaseInput = z.infer<typeof purchaseInput>;

/** No defaults (Zod 4 keeps them inside `.partial()`, see goals.schemas.ts). */
export const purchasePatch = purchaseShape.partial();
export type PurchasePatch = z.infer<typeof purchasePatch>;
