import { describe, it, expect } from 'vitest';
import {
  toJalali,
  toGregorian,
  dateToJalali,
  formatJalaliShort,
  formatJalaliLong,
  toPersianDigits,
} from '../src/lib/jalali.ts';

describe('jalali conversion', () => {
  it('matches the reference library example (2016-04-11 → 1395-01-23)', () => {
    expect(toJalali(2016, 4, 11)).toEqual({ jy: 1395, jm: 1, jd: 23 });
    expect(toGregorian(1395, 1, 23)).toEqual({ gy: 2016, gm: 4, gd: 11 });
  });

  it('maps Nowruz 1403 (2024-03-20) to 1403-01-01', () => {
    expect(toJalali(2024, 3, 20)).toEqual({ jy: 1403, jm: 1, jd: 1 });
  });

  it('round-trips gregorian → jalali → gregorian across a range', () => {
    for (let t = Date.UTC(2015, 0, 1); t < Date.UTC(2035, 0, 1); t += 86_400_000 * 37) {
      const d = new Date(t);
      const gy = d.getUTCFullYear();
      const gm = d.getUTCMonth() + 1;
      const gd = d.getUTCDate();
      const j = toJalali(gy, gm, gd);
      expect(toGregorian(j.jy, j.jm, j.jd)).toEqual({ gy, gm, gd });
    }
  });
});

describe('jalali formatting', () => {
  it('converts digits to Persian', () => {
    expect(toPersianDigits('1404/04/11')).toBe('۱۴۰۴/۰۴/۱۱');
    expect(toPersianDigits(23)).toBe('۲۳');
  });

  it('formats a known date (2016-04-11 = Monday 23 Farvardin 1395)', () => {
    const d = new Date(2016, 3, 11); // local April 11 2016
    expect(dateToJalali(d)).toEqual({ jy: 1395, jm: 1, jd: 23 });
    expect(formatJalaliShort(d)).toBe('۱۳۹۵/۰۱/۲۳');
    expect(formatJalaliLong(d)).toContain('فروردین');
    expect(formatJalaliLong(d)).toContain('دوشنبه'); // Monday
    expect(formatJalaliLong(d)).toContain('۱۳۹۵');
  });
});
