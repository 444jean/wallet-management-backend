import { z } from 'zod';
import { isoDate, money, positiveMoney } from '../common/schemas.js';
import { INSTITUTIONS } from './institutions.js';

export const DEADLINE_WITHOUT_TARGET = 'Un fondo sin objetivo no puede tener fecha límite.';

/** Without a target (null/omitted) a goal is a "Fondo" (T10). */
const goalShape = z.object({
  name: z.string().trim().min(1).max(100),
  target: positiveMoney.nullish(),
  current: money,
  monthlyContribution: money,
  /** Annual percentage rate, e.g. 4 = 4%. */
  annualRate: z.number().min(0).max(100),
  deadline: isoDate.nullish(),
  /** Bank or wallet where it is kept (T11). */
  institution: z.enum(INSTITUTIONS).nullish(),
});

/** Fields of a new goal, with defaults. */
export const goalFields = goalShape.extend({
  current: money.default(0),
  monthlyContribution: money.default(0),
  annualRate: goalShape.shape.annualRate.default(0),
});

/** A deadline only makes sense with a target to reach. */
export function deadlineNeedsTarget(
  g: { target?: number | null; deadline?: string | null },
  ctx: z.RefinementCtx,
) {
  if (g.deadline && g.target == null) {
    ctx.addIssue({ code: 'custom', path: ['deadline'], message: DEADLINE_WITHOUT_TARGET });
  }
}

export const goalInput = goalFields.superRefine(deadlineNeedsTarget);
export type GoalInput = z.infer<typeof goalInput>;

/**
 * No defaults here: Zod 4 keeps `.default()` inside `.partial()`, so a partial
 * PATCH would reset omitted amounts to 0. The deadline/target rule is checked
 * in the service against the stored goal.
 */
export const goalPatch = goalShape.partial();
export type GoalPatch = z.infer<typeof goalPatch>;
