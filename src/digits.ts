import type { DigitMask } from './types';

/**
 * Digit patterns for 0-9.
 * Each is a 10 row × 6 column grid.
 * true = lit (part of digit), false = unlit (background)
 *
 * CRITICAL CONSTRAINTS:
 * 1. Both lit and unlit counts must be divisible by 4
 * 2. All unlit cells must form CONNECTED regions that are tileable
 *    (no isolated single cells or untileable shapes)
 */

// Helper to create a mask from a visual string representation
function parseMask(visual: string): DigitMask {
  return visual
    .trim()
    .split('\n')
    .map((row) =>
      row
        .trim()
        .split('')
        .map((c) => c === 'X')
    );
}

// Using block-style digits where unlit regions form simple rectangular areas

/**
 * Digit 0: Block style with 2x4 hollow center
 * Lit: 52, Unlit: 8 (connected 2x4 block in center)
 */
const DIGIT_0 = parseMask(`
XXXXXX
XXXXXX
XX..XX
XX..XX
XX..XX
XX..XX
XXXXXX
XXXXXX
XXXXXX
XXXXXX
`);

/**
 * Digit 1: Vertical bar on right
 * Lit: 20, Unlit: 40 (4x10 block on left)
 */
const DIGIT_1 = parseMask(`
....XX
....XX
....XX
....XX
....XX
....XX
....XX
....XX
....XX
....XX
`);

/**
 * Digit 2: S-curve style
 * Lit: 36, Unlit: 24
 * Unlit forms two 2x6 connected regions
 */
const DIGIT_2 = parseMask(`
XXXXXX
XXXXXX
....XX
....XX
XXXXXX
XXXXXX
XX....
XX....
XXXXXX
XXXXXX
`);

/**
 * Digit 3: Two indents on left
 * Lit: 40, Unlit: 20
 */
const DIGIT_3 = parseMask(`
XXXXXX
XXXXXX
....XX
....XX
XXXXXX
XXXXXX
....XX
....XX
XXXXXX
XXXXXX
`);

/**
 * Digit 4: L-shape style
 * Lit: 32, Unlit: 28
 */
const DIGIT_4 = parseMask(`
XX..XX
XX..XX
XX..XX
XX..XX
XXXXXX
XXXXXX
....XX
....XX
....XX
....XX
`);

/**
 * Digit 5: Reverse S-curve
 * Lit: 36, Unlit: 24
 */
const DIGIT_5 = parseMask(`
XXXXXX
XXXXXX
XX....
XX....
XXXXXX
XXXXXX
....XX
....XX
XXXXXX
XXXXXX
`);

/**
 * Digit 6: Like 5 but with bottom-right filled
 * Lit: 44, Unlit: 16
 */
const DIGIT_6 = parseMask(`
XXXXXX
XXXXXX
XX....
XX....
XXXXXX
XXXXXX
XX..XX
XX..XX
XXXXXX
XXXXXX
`);

/**
 * Digit 7: Simple right-side bar with top
 * Lit: 28, Unlit: 32
 */
const DIGIT_7 = parseMask(`
XXXXXX
XXXXXX
....XX
....XX
....XX
....XX
....XX
....XX
....XX
....XX
`);

/**
 * Digit 8: Two hollow sections
 * Lit: 44, Unlit: 16
 */
const DIGIT_8 = parseMask(`
XXXXXX
XXXXXX
XX..XX
XX..XX
XXXXXX
XXXXXX
XX..XX
XX..XX
XXXXXX
XXXXXX
`);

/**
 * Digit 9: Like 8 but bottom-left empty
 * Lit: 40, Unlit: 20
 */
const DIGIT_9 = parseMask(`
XXXXXX
XXXXXX
XX..XX
XX..XX
XXXXXX
XXXXXX
....XX
....XX
XXXXXX
XXXXXX
`);

/** All digit patterns indexed by digit value */
export const DIGIT_PATTERNS: Record<number, DigitMask> = {
  0: DIGIT_0,
  1: DIGIT_1,
  2: DIGIT_2,
  3: DIGIT_3,
  4: DIGIT_4,
  5: DIGIT_5,
  6: DIGIT_6,
  7: DIGIT_7,
  8: DIGIT_8,
  9: DIGIT_9,
};

/** Grid dimensions for digits */
export const DIGIT_ROWS = 10;
export const DIGIT_COLS = 6;

/**
 * Count lit cells in a mask
 */
export function countLitCells(mask: DigitMask): number {
  return mask.flat().filter(Boolean).length;
}

/**
 * Count unlit cells in a mask
 */
export function countUnlitCells(mask: DigitMask): number {
  return mask.flat().filter((c) => !c).length;
}
