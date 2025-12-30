/**
 * Time formatting and manipulation utilities
 */

/**
 * Formats hours and minutes as HH:MM string.
 *
 * @param hours - Hour value (0-23 for standard time, can be higher for countdown)
 * @param minutes - Minute value (0-59)
 * @returns Formatted time string (e.g., "09:45", "12:30")
 */
export function formatHHMM(hours: number, minutes: number): string {
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Floors a date to the nearest minute by setting seconds and milliseconds to 0.
 *
 * @param date - Date to floor
 * @returns New Date object floored to the minute
 */
export function floorToMinute(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}
