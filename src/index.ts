// Tetris Time Tiler - Public API

// Core types
export type {
  TetrominoType,
  Cell,
  Tetromino,
  PlacedTetromino,
  TileStats,
  TileResult,
  TileOptions,
  DigitMask,
  MoveDirection,
  PlacementStep,
  SequencedPiece,
  SequenceResult,
} from "./types";

// Tetromino definitions
export { TETROMINOES, TETROMINO_TYPES, getAbsoluteCells } from "./tetrominoes";

// Digit patterns
export { DIGIT_PATTERNS, DIGIT_ROWS, DIGIT_COLS, countLitCells, countUnlitCells } from "./digits";

// Solver API
export {
  tileDigit,
  tileTime,
  tileGrid,
  tileTimeGrid,
  TIME_ROWS,
  TIME_COLS,
  TIME_DIGIT_GAP_COLS,
  TIME_COLON_GAP_COLS,
} from "./solver";

// Sequencer API
export { sequencePieces } from "./sequencer";
