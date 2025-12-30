/**
 * URL parameter parsing utilities
 */

/**
 * Parses and validates the speed parameter from URL search params.
 * Returns a number between 1 and 10, defaults to 3 if invalid or not present.
 *
 * @param params - URLSearchParams object to parse
 * @param defaultSpeed - Default speed value (default: 3)
 * @param maxSpeed - Maximum allowed speed (default: 10)
 * @returns Validated speed value
 */
export function parseSpeedParam(
  params: URLSearchParams,
  defaultSpeed = 3,
  maxSpeed = 10
): number {
  const speedParam = params.get("speed");
  if (speedParam !== null) {
    const parsed = parseFloat(speedParam);
    if (!isNaN(parsed) && parsed > 0) {
      return Math.min(parsed, maxSpeed);
    }
  }
  return defaultSpeed;
}
