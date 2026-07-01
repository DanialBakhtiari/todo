import { toPersianDigits } from './jalali.ts';

/** Current time as ISO string. */
export function nowISO(): string {
  return new Date().toISOString();
}

/** Local Date → 'YYYY-MM-DD' (calendar day, no timezone shift). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse an ISO date/datetime; returns null on anything invalid. */
export function parseISO(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** «۱۱ تیر ۱۴۰۴» style is handled in jalali.ts; here is the Gregorian side. */
export function formatGregorianLong(date: Date): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      calendar: 'gregory',
      dateStyle: 'full',
      timeStyle: 'medium',
    }).format(date);
  } catch {
    return toPersianDigits(date.toLocaleString('fa-IR'));
  }
}

/** «۱۴:07» — 24h clock in Persian digits. */
export function formatTimeFa(date: Date): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return toPersianDigits(
      `${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes(),
      ).padStart(2, '0')}`,
    );
  }
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'normal';

export interface DueMeta {
  label: string;
  tone: DueTone;
  days: number;
}

/** Whole-day difference between two dates, ignoring the time-of-day. */
function dayDiff(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Human, RTL-friendly relative label for a due date. */
export function dueMeta(dueISO: string, today: Date = new Date()): DueMeta | null {
  const due = parseISO(dueISO);
  if (!due) return null;
  const days = dayDiff(today, due);

  if (days < 0) {
    const n = Math.abs(days);
    return {
      days,
      tone: 'overdue',
      label: n === 1 ? 'دیروز' : `${toPersianDigits(n)} روز گذشته`,
    };
  }
  if (days === 0) return { days, tone: 'today', label: 'امروز' };
  if (days === 1) return { days, tone: 'soon', label: 'فردا' };
  if (days <= 3)
    return { days, tone: 'soon', label: `${toPersianDigits(days)} روز مانده` };
  return { days, tone: 'normal', label: `${toPersianDigits(days)} روز مانده` };
}
