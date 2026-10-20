import { z } from 'zod';
import { deadlineNeedsTarget, goalFields } from '../goals/goals.schemas.js';
import { salaryInput } from '../salary/salary.schemas.js';
import { transactionInput } from '../transactions/transactions.schemas.js';

/**
 * Same shape as the frontend's localStorage blob (`FinanceData`), used to
 * migrate existing browser data into the account.
 */
export const financeImport = z.object({
  transactions: z
    .array(
      transactionInput.extend({
        id: z.string().optional(),
        source: z.literal('salary').optional(),
      }),
    )
    .max(20_000),
  goals: z
    .array(goalFields.extend({ id: z.string() }).superRefine(deadlineNeedsTarget))
    .max(500),
  salary: salaryInput.nullable(),
  /** Required to overwrite an account that already has data. */
  replace: z.boolean().default(false),
});
export type FinanceImport = z.infer<typeof financeImport>;
