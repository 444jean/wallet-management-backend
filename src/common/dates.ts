import { env } from '../config/env.js';

/** "YYYY-MM-DD" -> Date at UTC midnight (how Postgres DATE columns round-trip). */
export function parseISODate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date (UTC midnight) -> "YYYY-MM-DD". */
export function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's date as "YYYY-MM-DD" in the app timezone. */
export function todayISO(
  now = new Date(),
  timeZone = env.APP_TIMEZONE,
): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Current month as "YYYY-MM" in the app timezone. */
export function currentMonthKey(now = new Date(), timeZone = env.APP_TIMEZONE) {
  return todayISO(now, timeZone).slice(0, 7);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
