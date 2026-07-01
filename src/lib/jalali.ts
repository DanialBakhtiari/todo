/**
 * Jalali (Persian / Shamsi) calendar utilities.
 *
 * Conversion core is a TypeScript port of the MIT-licensed `jalaali-js`
 * algorithm (Behrang Noruzi Niya / Roozbeh Pournader). Ported inline — rather
 * than depending on the CJS package — so the whole module is pure, typed, and
 * unit-testable under jsdom without relying on Intl's Persian calendar.
 */

export interface JalaliDate {
  jy: number;
  jm: number;
  jd: number;
}

// NOTE: truncation toward zero (like the reference `~~`), NOT Math.floor —
// they differ for negative operands (e.g. breaks[0] = -61) and that difference
// is load-bearing for the conversion to be correct.
const div = (a: number, b: number): number => Math.trunc(a / b);
const mod = (a: number, b: number): number => a - Math.trunc(a / b) * b;

interface JalCal {
  leap: number;
  gy: number;
  march: number;
}

function jalCal(jy: number): JalCal {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
    2192, 2262, 2324, 2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0]!;

  if (jy < jp || jy >= breaks[bl - 1]!) {
    throw new RangeError(`Invalid Jalali year ${jy}`);
  }

  let jump = 0;
  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): JalaliDate {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      const jm = 1 + div(k, 31);
      const jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  const jm = 7 + div(k, 30);
  const jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

/** Gregorian (Y, M[1-12], D) → Jalali. */
export function toJalali(gy: number, gm: number, gd: number): JalaliDate {
  return d2j(g2d(gy, gm, gd));
}

/** Jalali (Y, M[1-12], D) → Gregorian. */
export function toGregorian(
  jy: number,
  jm: number,
  jd: number,
): { gy: number; gm: number; gd: number } {
  return d2g(j2d(jy, jm, jd));
}

/** A JS Date (local time) → Jalali parts. */
export function dateToJalali(date: Date): JalaliDate {
  return toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

/** Persian weekday names keyed by JS getDay() (0 = Sunday). */
const WEEKDAYS: Record<number, string> = {
  6: 'شنبه',
  0: 'یکشنبه',
  1: 'دوشنبه',
  2: 'سه‌شنبه',
  3: 'چهارشنبه',
  4: 'پنجشنبه',
  5: 'جمعه',
};

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Convert Latin digits in a string to Persian digits. */
export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]!);
}

export function jalaliWeekday(date: Date): string {
  return WEEKDAYS[date.getDay()] ?? '';
}

/** e.g. «پنجشنبه ۱۱ تیر ۱۴۰۴» */
export function formatJalaliLong(date: Date): string {
  const { jy, jm, jd } = dateToJalali(date);
  return `${jalaliWeekday(date)} ${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
}

/** e.g. «۱۴۰۴/۰۴/۱۱» */
export function formatJalaliShort(date: Date): string {
  const { jy, jm, jd } = dateToJalali(date);
  const p2 = (n: number) => toPersianDigits(String(n).padStart(2, '0'));
  return `${toPersianDigits(jy)}/${p2(jm)}/${p2(jd)}`;
}

/** e.g. «۱۱ تیر» — compact day + month, for task meta rows. */
export function formatJalaliDayMonth(date: Date): string {
  const { jm, jd } = dateToJalali(date);
  return `${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]}`;
}
