/**
 * Business timezone utilities.
 *
 * All "what day is it?" and "day boundary" calculations must use the
 * business timezone (Europe/Podgorica) so that results are correct
 * regardless of the server's system timezone.
 */

import { DayOfWeek } from '../../generated/prisma';

const BUSINESS_TZ = 'Europe/Podgorica';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dowFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TZ,
  weekday: 'short',
});

const DOW_MAP: Record<string, DayOfWeek> = {
  Sun: 'SUNDAY',
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
};

/**
 * Returns today's date string (YYYY-MM-DD) in business timezone.
 */
export function getBusinessToday(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

/**
 * Returns yesterday's date string (YYYY-MM-DD) in business timezone.
 */
export function getBusinessYesterday(now: Date = new Date()): string {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return dateFormatter.format(yesterday);
}

/**
 * Returns the DayOfWeek enum value for a date in business timezone.
 */
export function getBusinessDayOfWeek(date: Date = new Date()): DayOfWeek {
  return DOW_MAP[dowFormatter.format(date)];
}

/**
 * Parses a YYYY-MM-DD string into a UTC midnight Date (for DB queries).
 */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/**
 * Returns UTC start and end boundaries for a calendar day in business timezone.
 *
 * Example: In Europe/Podgorica (UTC+1 winter), "2026-02-14" becomes:
 *   start = 2026-02-13T23:00:00Z
 *   end   = 2026-02-14T22:59:59.999Z
 */
export function getBusinessDayBounds(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Create a date at noon UTC on that day so we're safely within the right day
  // even in the business timezone, then use Intl to find the exact offset
  const refDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));

  // Get the timezone offset by comparing local representation with UTC
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(refDate);

  const getPart = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0');

  const localAtRef = new Date(
    Date.UTC(getPart('year'), getPart('month') - 1, getPart('day'), getPart('hour'), getPart('minute'), getPart('second'))
  );

  const offsetMs = localAtRef.getTime() - refDate.getTime();

  // Start of day in business timezone = midnight local = midnight - offset in UTC
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - offsetMs);
  const end = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - offsetMs);

  return { start, end };
}

/**
 * Converts a business-local wall-clock time (HH:MM) on a specific date (YYYY-MM-DD)
 * to a proper UTC Date.
 *
 * Example: toBusinessUTC("2026-02-14", "17:00") in Europe/Podgorica (UTC+1 winter)
 *   → 2026-02-14T16:00:00Z  (17:00 local = 16:00 UTC)
 */
export function toBusinessUTC(dateStr: string, time: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);

  // Get offset for this date using the same approach as getBusinessDayBounds
  const refDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(refDate);

  const getPart = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? '0');

  const localAtRef = new Date(
    Date.UTC(getPart('year'), getPart('month') - 1, getPart('day'), getPart('hour'), getPart('minute'), getPart('second'))
  );

  const offsetMs = localAtRef.getTime() - refDate.getTime();

  return new Date(Date.UTC(y, m - 1, d, h, min, 0, 0) - offsetMs);
}

/**
 * Returns UTC start and end boundaries for a calendar month in business timezone.
 */
export function getBusinessMonthBounds(year: number, month: number): { start: Date; end: Date } {
  // First day of month
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;

  // Last day of month
  const lastDayDate = new Date(Date.UTC(year, month, 0)); // day 0 of next month = last day of this month
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayDate.getUTCDate()).padStart(2, '0')}`;

  const { start } = getBusinessDayBounds(firstDay);
  const { end } = getBusinessDayBounds(lastDay);

  return { start, end };
}

/**
 * Formats a Date in business timezone as YYYY-MM-DD.
 */
export function formatBusinessDate(date: Date): string {
  return dateFormatter.format(date);
}

/**
 * Formats a Date in business timezone for display in emails/notifications.
 */
export function formatBusinessDateLocale(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('sr-Latn-ME', {
    timeZone: BUSINESS_TZ,
    ...options,
  });
}

/**
 * Iterates over each day in a date range (YYYY-MM-DD strings),
 * returning YYYY-MM-DD keys computed in business timezone.
 */
export function eachDayInRange(startStr: string, endStr: string): string[] {
  const days: string[] = [];
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  const current = new Date(start);
  while (current <= end) {
    days.push(
      `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')}`
    );
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return days;
}
