import type { Transaction } from '../generated/prisma/client.js';
import { toISODate } from '../common/dates.js';

/** API shape — matches the frontend's `Transaction` type. */
export interface TransactionDto {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: string;
  source?: 'salary';
  goalId?: string;
}

export function toTransactionDto(t: Transaction): TransactionDto {
  return {
    id: t.id,
    type: t.type,
    amount: t.amount,
    category: t.category,
    description: t.description,
    date: toISODate(t.date),
    ...(t.source ? { source: t.source } : {}),
    ...(t.goalId ? { goalId: t.goalId } : {}),
  };
}
