import type { Cell, PlacedTetromino, Tetromino, DigitMask } from './types';
import { getAbsoluteCells } from './tetrominoes';

let pieceIdCounter = 0;

/** Generate a unique piece ID */
function generatePieceId(): string {
  return `piece-${++pieceIdCounter}`;
}

/** Reset the piece ID counter (useful for testing) */
export function resetPieceIdCounter(): void {
  pieceIdCounter = 0;
}

/**
 * Grid manages the state of a tetromino tiling grid.
 * It tracks which cells are filled and enforces placement constraints.
 */
export class Grid {
  readonly rows: number;
  readonly cols: number;
  private cells: (PlacedTetromino | null)[][];
  private mask: DigitMask;
  private placedPieces: Map<string, PlacedTetromino>;

  constructor(rows: number, cols: number, mask?: DigitMask) {
    this.rows = rows;
    this.cols = cols;
    this.cells = Array.from({ length: rows }, () => Array(cols).fill(null));
    this.placedPieces = new Map();

    // Default mask: all cells are "lit" (uniform grid)
    this.mask = mask ?? Array.from({ length: rows }, () => Array(cols).fill(true));
  }

  /**
   * Check if a tetromino can be placed at the given anchor position.
   * Validates:
   * 1. All cells within bounds
   * 2. No overlap with existing pieces
   * 3. All cells have the same mask value (all lit or all unlit)
   */
  canPlace(tetromino: Tetromino, rotationIndex: number, anchor: Cell): boolean {
    const cells = getAbsoluteCells(tetromino, rotationIndex, anchor);

    // Check bounds
    for (const cell of cells) {
      if (cell.row < 0 || cell.row >= this.rows) return false;
      if (cell.col < 0 || cell.col >= this.cols) return false;
    }

    // Check no overlap
    for (const cell of cells) {
      if (this.cells[cell.row][cell.col] !== null) return false;
    }

    // Check mask constraint: all cells must have the same mask value
    const firstMaskValue = this.mask[cells[0].row][cells[0].col];
    for (const cell of cells) {
      if (this.mask[cell.row][cell.col] !== firstMaskValue) return false;
    }

    return true;
  }

  /**
   * Place a tetromino at the given anchor position.
   * Returns the placed piece. Throws if placement is invalid.
   */
  place(tetromino: Tetromino, rotationIndex: number, anchor: Cell): PlacedTetromino {
    if (!this.canPlace(tetromino, rotationIndex, anchor)) {
      throw new Error(`Cannot place ${tetromino.type} at (${anchor.row}, ${anchor.col})`);
    }

    const cells = getAbsoluteCells(tetromino, rotationIndex, anchor);
    const isLit = this.mask[cells[0].row][cells[0].col];

    const piece: PlacedTetromino = {
      id: generatePieceId(),
      type: tetromino.type,
      rotationIndex,
      anchor,
      cells,
      isLit,
    };

    // Mark cells as occupied
    for (const cell of cells) {
      this.cells[cell.row][cell.col] = piece;
    }

    this.placedPieces.set(piece.id, piece);
    return piece;
  }

  /**
   * Remove a placed piece by its ID.
   */
  remove(pieceId: string): void {
    const piece = this.placedPieces.get(pieceId);
    if (!piece) {
      throw new Error(`Piece ${pieceId} not found`);
    }

    // Clear cells
    for (const cell of piece.cells) {
      this.cells[cell.row][cell.col] = null;
    }

    this.placedPieces.delete(pieceId);
  }

  /**
   * Find the first empty cell (scanning left-to-right, top-to-bottom).
   * Returns null if the grid is full.
   */
  findFirstEmpty(): Cell | null {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (this.cells[row][col] === null) {
          return { row, col };
        }
      }
    }
    return null;
  }

  /**
   * Check if the grid is completely filled.
   */
  isFull(): boolean {
    return this.findFirstEmpty() === null;
  }

  /**
   * Get all placed pieces.
   */
  getPlacedPieces(): PlacedTetromino[] {
    return Array.from(this.placedPieces.values());
  }

  /**
   * Get the current grid state (cell references).
   */
  getCells(): (PlacedTetromino | null)[][] {
    return this.cells.map((row) => [...row]);
  }

  /**
   * Get the mask value for a cell.
   */
  getMaskValue(row: number, col: number): boolean {
    return this.mask[row][col];
  }

  /**
   * Create a deep clone of this grid.
   */
  clone(): Grid {
    const cloned = new Grid(this.rows, this.cols, this.mask);

    // Copy placed pieces
    for (const piece of this.placedPieces.values()) {
      // Manually add the piece without generating a new ID
      cloned.placedPieces.set(piece.id, piece);
      for (const cell of piece.cells) {
        cloned.cells[cell.row][cell.col] = piece;
      }
    }

    return cloned;
  }
}
