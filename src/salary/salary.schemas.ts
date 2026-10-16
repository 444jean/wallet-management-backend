import { z } from 'zod';
import { monthKey, positiveMoney } from '../common/schemas.js';

export const salaryInput = z.object({
  amount: positiveMoney,
  category: z.string().trim().min(1).max(50),
  description: z.string().trim().max(200),
  day: z.number().int().min(1).max(31),
  since: monthKey,
});
export type SalaryInput = z.infer<typeof salaryInput>;
