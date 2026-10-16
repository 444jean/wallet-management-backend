import { z } from 'zod';

export const isoDate = z.iso.date(); // "YYYY-MM-DD"
export const monthKey = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');
/** Whole CLP amount. */
export const money = z.number().int().nonnegative().max(1_000_000_000_000);
export const positiveMoney = money.positive();
