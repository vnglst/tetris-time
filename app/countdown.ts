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
 * Parse the target date from URL 'to' parameter.
 * Expects ISO 8601 format (e.g., 2025-01-01T00:00:00).
 * Returns null if not present or invalid.
 */
export function getTargetDateFromUrl(): Date | null {
  const params = new URLSearchParams(window.location.search);
  const toParam = params.get("to");
  if (!toParam) {
    return null;
  }

  const date = new Date(toParam);
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
