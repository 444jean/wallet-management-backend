import { z } from 'zod';
import { isoDate, money, positiveMoney } from '../common/schemas.js';

export const goalInput = z.object({
  name: z.string().trim().min(1).max(100),
  target: positiveMoney,
  current: money.default(0),
  monthlyContribution: money.default(0),
  /** Annual percentage rate, e.g. 4 = 4%. */
  annualRate: z.number().min(0).max(100).default(0),
  deadline: isoDate.nullish(),
});
export type GoalInput = z.infer<typeof goalInput>;

export const goalPatch = goalInput.partial();
export type GoalPatch = z.infer<typeof goalPatch>;
