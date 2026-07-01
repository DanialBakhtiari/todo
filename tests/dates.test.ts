import { describe, it, expect } from 'vitest';
import { toISODate, parseISO, dueMeta } from '../src/lib/dates.ts';

describe('dates', () => {
  it('formats a local date as ISO day without timezone drift', () => {
    expect(toISODate(new Date(2026, 6, 1))).toBe('2026-07-01');
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('parses valid ISO and rejects garbage', () => {
    expect(parseISO('2026-07-01')).toBeInstanceOf(Date);
    expect(parseISO('not-a-date')).toBeNull();
    expect(parseISO('')).toBeNull();
    expect(parseISO(undefined)).toBeNull();
  });

  it('computes relative due labels', () => {
    const today = new Date(2026, 6, 1);
    expect(dueMeta('2026-07-01', today)).toMatchObject({ tone: 'today', label: 'امروز' });
    expect(dueMeta('2026-07-02', today)).toMatchObject({ tone: 'soon', label: 'فردا' });
    expect(dueMeta('2026-06-30', today)).toMatchObject({ tone: 'overdue', label: 'دیروز' });
    expect(dueMeta('2026-06-25', today)?.tone).toBe('overdue');
    expect(dueMeta('2026-07-10', today)?.tone).toBe('normal');
  });
});
