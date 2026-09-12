/**
 * war-dates.ts
 *
 * Utility functions for ROW-TopGuild war day (วันวอ) logic.
 *
 * Rules:
 *  - War cycle begins on START_DATE = 2026-09-15 (Tuesday).
 *  - War days are Tuesday (2), Thursday (4), Sunday (0) in JavaScript getDay() values.
 *  - All date decisions are made in Asia/Bangkok timezone (UTC+7).
 *  - No date before START_DATE is considered a war day in the new cycle.
 */

/** First day of the new war cycle — ISO "YYYY-MM-DD" in Thailand time */
export const WAR_START_DATE = "2026-09-15";

/**
 * JavaScript `getDay()` values of war days.
 * 0 = Sunday, 2 = Tuesday, 4 = Thursday.
 */
export const WAR_WEEKDAYS: readonly number[] = [0, 2, 4]; // Sun, Tue, Thu

/** Thai names mapped from JS getDay() */
export const DAY_NAME_TH: Record<number, string> = {
  0: "อาทิตย์",
  1: "จันทร์",
  2: "อังคาร",
  3: "พุธ",
  4: "พฤหัสบดี",
  5: "ศุกร์",
  6: "เสาร์",
};

/**
 * Return current date string "YYYY-MM-DD" in Asia/Bangkok (UTC+7) timezone.
 * Does NOT rely on the browser/OS locale — always applies a fixed +7h offset.
 */
export function getThailandDateStr(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
}

/**
 * Given a "YYYY-MM-DD" string, return JS getDay() value (0=Sun … 6=Sat)
 * using the ISO-string trick (noon UTC avoids any DST/TZ edge at midnight).
 */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/**
 * Return true if `dateStr` is on or after WAR_START_DATE.
 */
export function isAfterOrOnStartDate(dateStr: string): boolean {
  return dateStr >= WAR_START_DATE;
}

/**
 * Return true if `dateStr` is a valid war day (Tue/Thu/Sun)
 * AND on or after WAR_START_DATE.
 */
export function isWarDay(dateStr: string): boolean {
  if (!isAfterOrOnStartDate(dateStr)) return false;
  return WAR_WEEKDAYS.includes(weekdayOf(dateStr));
}

/**
 * Given a "YYYY-MM-DD" date string (Thailand date), return the next war date
 * on or after that date.
 *
 * "Next" means: if `dateStr` itself is a war day, return `dateStr`.
 * Otherwise step forward day-by-day until we find a war day.
 *
 * The result is always >= WAR_START_DATE.
 */
export function getNextWarDate(dateStr: string): string {
  // If the given date is before the cycle start, jump to START_DATE
  const base = dateStr < WAR_START_DATE ? WAR_START_DATE : dateStr;

  let cursor = base;
  // At most 7 iterations (one full week)
  for (let i = 0; i < 7; i++) {
    if (WAR_WEEKDAYS.includes(weekdayOf(cursor))) return cursor;
    cursor = addDays(cursor, 1);
  }
  // Fallback — should never be reached
  return cursor;
}

/**
 * Return the most recent war date that is <= `dateStr`.
 * If `dateStr` is a war day itself, return `dateStr`.
 * If `dateStr` is before WAR_START_DATE, returns WAR_START_DATE.
 */
export function getPreviousWarDate(dateStr: string): string {
  if (dateStr < WAR_START_DATE) return WAR_START_DATE;

  let cursor = dateStr;
  for (let i = 0; i < 7; i++) {
    if (WAR_WEEKDAYS.includes(weekdayOf(cursor))) return cursor;
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

/**
 * Add `days` days to a "YYYY-MM-DD" string and return a new "YYYY-MM-DD" string.
 * Uses UTC arithmetic to avoid DST edge cases.
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

/**
 * Compute the default war date to display when the attendance page loads.
 *
 * Logic:
 *  1. Get today's date in Thailand timezone.
 *  2. If today is a war day → return today.
 *  3. Otherwise → return the next upcoming war day.
 *
 * Result is always >= WAR_START_DATE (no date before the new cycle).
 */
export function getDefaultWarDate(): string {
  const today = getThailandDateStr();
  return getNextWarDate(today);
}

/**
 * Validate a stored localStorage date against today.
 * Returns true only if:
 *  - `savedDate` is a valid "YYYY-MM-DD" string
 *  - `savedDate` >= WAR_START_DATE  (must be within new cycle)
 *  - `savedDate` <= today + 7 days  (not a far-future date — sanity check)
 *
 * A date that fails validation should be IGNORED and the default war date used
 * instead.
 */
export function isValidSavedDate(savedDate: string | null | undefined): savedDate is string {
  if (!savedDate || !/^\d{4}-\d{2}-\d{2}$/.test(savedDate)) return false;
  const today = getThailandDateStr();
  const maxFuture = addDays(today, 7);
  return savedDate >= WAR_START_DATE && savedDate <= maxFuture;
}

/**
 * Generate an array of `count` war dates starting from `fromDate` (inclusive).
 * Each entry: { date: "YYYY-MM-DD", dayName: "อังคาร"|"พฤหัสบดี"|"อาทิตย์" }
 */
export function generateWarDates(
  fromDate: string,
  count: number
): { date: string; dayName: string }[] {
  const results: { date: string; dayName: string }[] = [];
  let cursor = getNextWarDate(fromDate);
  while (results.length < count) {
    results.push({ date: cursor, dayName: DAY_NAME_TH[weekdayOf(cursor)] });
    cursor = getNextWarDate(addDays(cursor, 1));
  }
  return results;
}
