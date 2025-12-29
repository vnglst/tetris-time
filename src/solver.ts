import type { TileResult, TileStats, TileOptions, DigitMask, PlacedTetromino } from './types';
import { Grid, resetPieceIdCounter } from './grid';
import { TETROMINOES, TETROMINO_TYPES } from './tetrominoes';
import { DIGIT_PATTERNS, DIGIT_ROWS, DIGIT_COLS } from './digits';

/** Default maximum attempts before giving up */
const DEFAULT_MAX_ATTEMPTS = 1_000_000;

/**
 * Simple seeded random number generator (Mulberry32)
 */
class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed;
  }

  /** Get next random number in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Shuffle an array in place */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

/** Convert seed (number or string) to a number */
function seedToNumber(seed: number | string | undefined): number {
  if (seed === undefined) {
    return Date.now();
  }
  if (typeof seed === 'number') {
    return seed;
  }
  // Hash string to number
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

/** Generate all possible (tetromino, rotationIndex) combinations */
interface Placement {
  tetrominoType: (typeof TETROMINO_TYPES)[number];
  rotationIndex: number;
}

function getAllPlacements(): Placement[] {
  const placements: Placement[] = [];
  for (const type of TETROMINO_TYPES) {
    const tetromino = TETROMINOES[type];
    for (let rotationIndex = 0; rotationIndex < tetromino.rotations.length; rotationIndex++) {
      placements.push({ tetrominoType: type, rotationIndex });
    }
  }
  return placements;
}

/** Solver state for tracking progress */
interface SolverState {
  attempts: number;
  backtracks: number;
  maxAttempts: number;
}

/**
 * For a given tetromino rotation, find all anchor positions that would
 * cause the piece to cover the target cell.
 */
function getAnchorsToCoverCell(
  tetromino: (typeof TETROMINOES)[keyof typeof TETROMINOES],
  rotationIndex: number,
  targetCell: { row: number; col: number }
): { row: number; col: number }[] {
  const rotation = tetromino.rotations[rotationIndex];
  const anchors: { row: number; col: number }[] = [];

  // For each cell in the rotation, calculate what anchor would place that cell at targetCell
  for (const relativeCell of rotation) {
    anchors.push({
      row: targetCell.row - relativeCell.row,
      col: targetCell.col - relativeCell.col,
    });
  }

  return anchors;
}

/**
 * Backtracking solver for tiling a grid with tetrominoes.
 */
function backtrack(
  grid: Grid,
  placements: Placement[],
  random: SeededRandom,
  state: SolverState
): boolean {
  // Base case: grid is full
  if (grid.isFull()) {
    return true;
  }

  // Timeout protection
  if (state.attempts >= state.maxAttempts) {
    return false;
  }

  // Find first empty cell
  const emptyCell = grid.findFirstEmpty();
  if (!emptyCell) {
    return true;
  }

  // Shuffle placements for variety
  const shuffledPlacements = random.shuffle(placements);

  for (const { tetrominoType, rotationIndex } of shuffledPlacements) {
    const tetromino = TETROMINOES[tetrominoType];

    // Get all anchor positions that would cover the empty cell
    const anchors = getAnchorsToCoverCell(tetromino, rotationIndex, emptyCell);

    for (const anchor of anchors) {
      state.attempts++;

      if (grid.canPlace(tetromino, rotationIndex, anchor)) {
        const piece = grid.place(tetromino, rotationIndex, anchor);

        if (backtrack(grid, placements, random, state)) {
          return true;
        }

        // Backtrack
        grid.remove(piece.id);
        state.backtracks++;
      }
    }
  }

  return false;
}

/**
 * Tile a grid with the given mask.
 */
export function tileGrid(
  rows: number,
  cols: number,
  mask: DigitMask,
  options?: TileOptions
): TileResult {
  const startTime = performance.now();
  const seed = seedToNumber(options?.seed);
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  // Reset piece ID counter for consistent results
  resetPieceIdCounter();

  const grid = new Grid(rows, cols, mask);
  const random = new SeededRandom(seed);
  const placements = getAllPlacements();

  const state: SolverState = {
    attempts: 0,
    backtracks: 0,
    maxAttempts,
  };

  const success = backtrack(grid, placements, random, state);

  const stats: TileStats = {
    attempts: state.attempts,
    backtracks: state.backtracks,
    duration: performance.now() - startTime,
  };

  return {
    success,
    pieces: grid.getPlacedPieces(),
    grid: grid.getCells(),
    stats,
  };
}

/**
 * Tile a single digit (0-9).
 */
export function tileDigit(digit: number, options?: TileOptions): TileResult {
  if (digit < 0 || digit > 9 || !Number.isInteger(digit)) {
    throw new Error(`Invalid digit: ${digit}. Must be an integer 0-9.`);
  }

  const mask = DIGIT_PATTERNS[digit];
  return tileGrid(DIGIT_ROWS, DIGIT_COLS, mask, options);
}

/**
 * Tile a full time display (HH:MM).
 * Returns an array of 4 TileResults, one for each digit.
 */
export function tileTime(
  hours: number,
  minutes: number,
  options?: TileOptions
): TileResult[] {
  if (hours < 0 || hours > 23 || !Number.isInteger(hours)) {
    throw new Error(`Invalid hours: ${hours}. Must be an integer 0-23.`);
  }
  if (minutes < 0 || minutes > 59 || !Number.isInteger(minutes)) {
    throw new Error(`Invalid minutes: ${minutes}. Must be an integer 0-59.`);
  }

  const h1 = Math.floor(hours / 10);
  const h2 = hours % 10;
  const m1 = Math.floor(minutes / 10);
  const m2 = minutes % 10;

  // Use different seeds for each digit to get variety
  const baseSeed = seedToNumber(options?.seed);

  return [
    tileDigit(h1, { ...options, seed: baseSeed }),
    tileDigit(h2, { ...options, seed: baseSeed + 1 }),
    tileDigit(m1, { ...options, seed: baseSeed + 2 }),
    tileDigit(m2, { ...options, seed: baseSeed + 3 }),
  ];
}
