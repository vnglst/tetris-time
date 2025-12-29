/** The 7 standard Tetris piece types */
export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

/** A cell position on the grid */
export interface Cell {
  row: number;
  col: number;
}

/** A tetromino definition with all its rotation states */
export interface Tetromino {
  type: TetrominoType;
  /** Each rotation is an array of 4 cells (relative to anchor at 0,0) */
  rotations: Cell[][];
}

/** A tetromino that has been placed on the grid */
export interface PlacedTetromino {
  id: string;
  type: TetrominoType;
  rotationIndex: number;
  /** The anchor position (top-left of bounding box) */
  anchor: Cell;
  /** Absolute cell positions on the grid */
  cells: Cell[];
  /** Whether this piece is in the "lit" (digit) or "unlit" (background) region */
  isLit: boolean;
}

/** Statistics about the tiling process */
export interface TileStats {
  /** Number of placement attempts made */
  attempts: number;
  /** Number of times the algorithm had to backtrack */
  backtracks: number;
  /** Time taken in milliseconds */
  duration: number;
}

/** Result of a tiling operation */
export interface TileResult {
  /** Whether tiling was successful */
  success: boolean;
  /** All placed tetrominoes */
  pieces: PlacedTetromino[];
  /** The grid state (each cell references its placed piece or null) */
  grid: (PlacedTetromino | null)[][];
  /** Statistics about the solving process */
  stats: TileStats;
}

/** Options for tiling operations */
export interface TileOptions {
  /** Seed for deterministic randomization */
  seed?: number | string;
  /** Maximum attempts before giving up */
  maxAttempts?: number;
}

/** A digit pattern mask (true = lit/digit, false = unlit/background) */
export type DigitMask = boolean[][];

/** Movement direction for horizontal movement */
export type MoveDirection = 'left' | 'right' | 'none';

/** A single step in the piece placement animation */
export interface PlacementStep {
  /** Type of movement */
  action: 'spawn' | 'rotate' | 'move' | 'drop' | 'lock';
  /** Current row (for drop actions) */
  row?: number;
  /** Current column (for move actions) */
  col?: number;
  /** Direction of movement */
  direction?: MoveDirection;
}

/** A sequenced piece with drop information */
export interface SequencedPiece {
  /** The placed tetromino */
  piece: PlacedTetromino;
  /** Order in which this piece should be placed (0 = first) */
  order: number;
  /** Column where piece should be positioned before dropping */
  dropColumn: number;
  /** Steps to animate this piece placement */
  steps: PlacementStep[];
}

/** Result of sequencing operation */
export interface SequenceResult {
  /** Whether sequencing was successful */
  success: boolean;
  /** Pieces in placement order (first to last) */
  sequence: SequencedPiece[];
  /** Grid dimensions */
  rows: number;
  cols: number;
}
