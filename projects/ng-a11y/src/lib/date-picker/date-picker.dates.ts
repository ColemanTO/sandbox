/**
 * Calendar dates as ISO strings (`2026-11-14`), which sort and compare as text. All arithmetic is done in UTC,
 * so daylight saving changes can never skip or repeat a day.
 */

const pad = (n: number, length = 2) => String(n).padStart(length, '0');
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromUtc = (date: Date) => toIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());

export const toIso = (year: number, month: number, day: number) => `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Whether the parts are a real date with a four-digit year. `2026-02-30` is not. */
export function isRealDate(year: number, month: number, day: number): boolean {
  return year >= 1000 && year <= 9999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** Today, in the user's own time zone. */
export function todayIso(): string {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(iso: string, days: number): string {
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Moves by whole months, keeping the day where it exists: 31 January plus one month is the last day of February. */
export function addMonths(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const index = year * 12 + (month - 1) + months;
  const [y, m] = [Math.floor(index / 12), (index % 12) + 1];
  return toIso(y, m, Math.min(day, daysInMonth(y, m)));
}

/** Day of the week, 0 (Sunday) to 6 (Saturday). */
export const weekday = (iso: string) => utc(iso).getUTCDay();

/** A `Date` for an ISO date, for `Intl.DateTimeFormat` with `timeZone: 'UTC'`. */
export const asDate = utc;

const TOKENS = /yyyy|MM|dd/g;

/** Writes an ISO date in a format made of `dd`, `MM` and `yyyy`, such as `dd/MM/yyyy`. */
export function formatDate(iso: string, format: string): string {
  const [yyyy, MM, dd] = iso.split('-');
  return format.replace(TOKENS, (token) => ({ yyyy, MM, dd })[token as 'yyyy' | 'MM' | 'dd']);
}

/**
 * Reads text typed in the given format and returns the ISO date, or null if it is not a real date.
 * Day and month may be typed without a leading zero; the year needs four digits.
 */
export function parseDate(text: string | null | undefined, format: string): string | null {
  if (!text) return null;
  const order: string[] = format.match(TOKENS) ?? [];
  const pattern = format
    .split(TOKENS)
    .map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .reduce((out, literal, i) => out + (i ? (order[i - 1] === 'yyyy' ? '(\\d{4})' : '(\\d{1,2})') : '') + literal, '');
  const match = text.trim().match(new RegExp(`^${pattern}$`));
  if (!match) return null;
  const part = (token: string) => Number(match[order.indexOf(token) + 1]);
  const [year, month, day] = [part('yyyy'), part('MM'), part('dd')];
  return isRealDate(year, month, day) ? toIso(year, month, day) : null;
}

/** First day of the week for a locale, 0 (Sunday) to 6. Monday where the browser cannot say. */
export function firstDayOfWeek(locale: string | undefined): number {
  try {
    const resolved = new Intl.Locale(locale ?? new Intl.DateTimeFormat().resolvedOptions().locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = (resolved.getWeekInfo?.() ?? resolved.weekInfo)?.firstDay;
    return typeof firstDay === 'number' ? firstDay % 7 : 1; // Intl counts Monday as 1 and Sunday as 7
  } catch {
    return 1;
  }
}
