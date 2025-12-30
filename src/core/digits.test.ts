import { describe, it, expect } from 'vitest';
import {
  DIGIT_PATTERNS,
  DIGIT_ROWS,
  DIGIT_COLS,
  countLitCells,
  countUnlitCells,
} from './digits';

describe('Digit Patterns', () => {
  it('should define all 10 digits (0-9)', () => {
    for (let d = 0; d <= 9; d++) {
      expect(DIGIT_PATTERNS).toHaveProperty(String(d));
    }
    expect(Object.keys(DIGIT_PATTERNS)).toHaveLength(10);
  });

  it('should have correct dimensions (10 rows × 6 cols) for each digit', () => {
    for (let d = 0; d <= 9; d++) {
      const pattern = DIGIT_PATTERNS[d];
      expect(pattern.length, `Digit ${d} should have ${DIGIT_ROWS} rows`).toBe(DIGIT_ROWS);
      for (let row = 0; row < pattern.length; row++) {
        expect(
          pattern[row].length,
          `Digit ${d} row ${row} should have ${DIGIT_COLS} cols`
        ).toBe(DIGIT_COLS);
      }
    }
  });

  it('should have lit count divisible by 4 for each digit', () => {
    for (let d = 0; d <= 9; d++) {
      const litCount = countLitCells(DIGIT_PATTERNS[d]);
      expect(
        litCount % 4,
        `Digit ${d} has ${litCount} lit cells (not divisible by 4)`
      ).toBe(0);
    }
  });

  it('should have unlit count divisible by 4 for each digit', () => {
    for (let d = 0; d <= 9; d++) {
      const unlitCount = countUnlitCells(DIGIT_PATTERNS[d]);
      expect(
        unlitCount % 4,
        `Digit ${d} has ${unlitCount} unlit cells (not divisible by 4)`
      ).toBe(0);
    }
  });

  it('should have lit + unlit = 60 for each digit', () => {
    const totalCells = DIGIT_ROWS * DIGIT_COLS;
    expect(totalCells).toBe(60);

    for (let d = 0; d <= 9; d++) {
      const litCount = countLitCells(DIGIT_PATTERNS[d]);
      const unlitCount = countUnlitCells(DIGIT_PATTERNS[d]);
      expect(
        litCount + unlitCount,
        `Digit ${d} should have ${totalCells} total cells`
      ).toBe(totalCells);
    }
  });

  it('should have reasonable lit cell counts', () => {
    // Digits should have between 20-56 lit cells
    // (lower bound: at least some visible, upper bound: leaves room for unlit region)
    for (let d = 0; d <= 9; d++) {
      const litCount = countLitCells(DIGIT_PATTERNS[d]);
      expect(litCount, `Digit ${d} has too few lit cells`).toBeGreaterThanOrEqual(20);
      expect(litCount, `Digit ${d} has too many lit cells`).toBeLessThanOrEqual(56);
    }
  });
});

describe('countLitCells', () => {
  it('should count lit cells correctly', () => {
    const mask = [
      [true, true, false],
      [false, true, false],
    ];
    expect(countLitCells(mask)).toBe(3);
  });

  it('should return 0 for empty mask', () => {
    const mask = [
      [false, false],
      [false, false],
    ];
    expect(countLitCells(mask)).toBe(0);
  });
});

describe('countUnlitCells', () => {
  it('should count unlit cells correctly', () => {
    const mask = [
      [true, true, false],
      [false, true, false],
    ];
    expect(countUnlitCells(mask)).toBe(3);
  });

  it('should return 0 for fully lit mask', () => {
    const mask = [
      [true, true],
      [true, true],
    ];
    expect(countUnlitCells(mask)).toBe(0);
  });
});
