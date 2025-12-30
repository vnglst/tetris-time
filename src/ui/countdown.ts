export type ClockMode = "clock" | "countdown";

export interface CountdownTime {
  hours: number;
  minutes: number;
  finished: boolean;
}

/**
 * Parse the mode parameter from URL.
 * Returns 'clock' (default) or 'countdown'.
 */
export function getModeFromUrl(): ClockMode {
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get("mode");
  if (modeParam?.toLowerCase() === "countdown") {
    return "countdown";
  }
  return "clock";
}

/**
 * Get the next New Year's midnight in the user's local timezone.
 * If it's already past midnight on Jan 1st, returns next year's New Year.
 */
export function getNextNewYear(now: Date = new Date()): Date {
  const year = now.getFullYear();
  // Create midnight Jan 1st in local timezone
  const thisNewYear = new Date(year, 0, 1, 0, 0, 0, 0);

  // If we're past this year's new year, return next year's
  if (now >= thisNewYear) {
    return new Date(year + 1, 0, 1, 0, 0, 0, 0);
  }
  return thisNewYear;
}

/**
 * Parse the target date from URL 'to' parameter.
 * - ISO 8601 format dates are interpreted as UTC (e.g., 2025-01-01T00:00:00 means midnight UTC)
 * - Special value "newyear" returns the next New Year's midnight in user's local timezone
 * Returns null if not present or invalid.
 */
export function getTargetDateFromUrl(now: Date = new Date()): Date | null {
  const params = new URLSearchParams(window.location.search);
  const toParam = params.get("to");
  if (!toParam) {
    return null;
  }

  // Handle special "newyear" value - returns next New Year in local timezone
  if (toParam.toLowerCase() === "newyear") {
    return getNextNewYear(now);
  }

  // URL decode issue: + in URLs is decoded as space, convert back for positive offsets
  const normalizedParam = toParam.replace(/ (\d{2}:\d{2})$/, "+$1");

  // Check if the date string already has timezone info (Z or +/-offset)
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(normalizedParam);

  // If no timezone specified, treat as UTC by appending 'Z'
  const dateString = hasTimezone ? normalizedParam : normalizedParam + "Z";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Calculate the countdown time remaining until target.
 * @param target - The target date/time to count down to
 * @param now - The current date/time (optional, defaults to new Date())
 * @returns Object with hours, minutes, and finished flag
 */
export function getCountdownTime(
  target: Date,
  now: Date = new Date()
): CountdownTime {
  const diffMs = target.getTime() - now.getTime();

  // If countdown finished (target in past or exactly now)
  if (diffMs <= 0) {
    return { hours: 0, minutes: 0, finished: true };
  }

  // Convert to total minutes (floor to current minute)
  const totalMinutes = Math.floor(diffMs / (1000 * 60));

  // Less than 1 minute remaining
  if (totalMinutes === 0) {
    return { hours: 0, minutes: 0, finished: false };
  }

  let hours = Math.floor(totalMinutes / 60);
  let minutes = totalMinutes % 60;

  // Cap at 99:59 (max displayable with HH:MM format)
  if (hours > 99) {
    hours = 99;
    minutes = 59;
  }

  return { hours, minutes, finished: false };
}
