import { z } from 'zod';
import { isoDate, positiveMoney } from '../common/schemas.js';

export const transactionInput = z.object({
  type: z.enum(['income', 'expense']),
  amount: positiveMoney,
  category: z.string().trim().min(1).max(50),
  description: z.string().trim().max(200).default(''),
  date: isoDate,
  /**
   * Linked savings goal: an expense is a contribution, an income is a
   * withdrawal (T16).
   */
  goalId: z.string().min(1).nullish(),
});
export type TransactionInput = z.infer<typeof transactionInput>;

export const transactionPatch = transactionInput.partial();
export type TransactionPatch = z.infer<typeof transactionPatch>;

export const transactionFilters = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  type: z.enum(['income', 'expense']).optional(),
  category: z.string().optional(),
  goalId: z.string().optional(),
});
export type TransactionFilters = z.infer<typeof transactionFilters>;
