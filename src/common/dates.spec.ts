import { describe, expect, it, vi } from 'vitest';

vi.mock('../config/env.js', () => ({
  env: { APP_TIMEZONE: 'America/Santiago' },
}));

const { currentMonthKey, daysInMonth, parseISODate, toISODate, todayISO } =
  await import('./dates.js');

describe('dates', () => {
  it('round-trips YYYY-MM-DD through Date', () => {
    expect(toISODate(parseISODate('2026-02-28'))).toBe('2026-02-28');
  });

  it('uses the app timezone for "today"', () => {
    // 02:00 UTC on Nov 1 is still Oct 31 in Santiago.
    const now = new Date('2026-11-01T02:00:00Z');
    expect(todayISO(now)).toBe('2026-10-31');
    expect(currentMonthKey(now)).toBe('2026-10');
  });

  it('knows month lengths, including leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 9)).toBe(30);
  });
});
