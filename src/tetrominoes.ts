import type { Tetromino, TetrominoType, Cell } from './types';

/**
 * All 7 standard Tetris tetrominoes with their rotation states.
 * Cells are defined relative to an anchor point at (0, 0).
 * The anchor is the top-left of the bounding box for each rotation.
 */
export const TETROMINOES: Record<TetrominoType, Tetromino> = {
  /**
   * I-piece: 2 rotations
   * Horizontal: ████
   * Vertical:   █
   *             █
   *             █
   *             █
   */
  I: {
    type: 'I',
    rotations: [
      // Horizontal
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 0, col: 3 },
      ],
      // Vertical
      [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
        { row: 3, col: 0 },
      ],
    ],
  },

  /**
   * O-piece: 1 rotation (symmetric)
   * ██
   * ██
   */
  O: {
    type: 'O',
    rotations: [
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ],
    ],
  },

  /**
   * T-piece: 4 rotations
   */
  T: {
    type: 'T',
    rotations: [
      // T pointing down: ███
      //                   █
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 1, col: 1 },
      ],
      // T pointing left:  █
      //                  ██
      //                   █
      [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 2, col: 1 },
      ],
      // T pointing up:  █
      //                ███
      [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
      ],
      // T pointing right: █
      //                   ██
      //                   █
      [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 2, col: 0 },
      ],
    ],
  },

  /**
   * S-piece: 2 rotations
   */
  S: {
    type: 'S',
    rotations: [
      // Horizontal:  ██
      //             ██
      [
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ],
      // Vertical: █
      //           ██
      //            █
      [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 2, col: 1 },
      ],
    ],
  },

  /**
   * Z-piece: 2 rotations
   */
  Z: {
    type: 'Z',
    rotations: [
      // Horizontal: ██
      //              ██
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
      ],
      // Vertical:  █
      //           ██
      //           █
      [
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 2, col: 0 },
      ],
    ],
  },

  /**
   * J-piece: 4 rotations
   */
  J: {
    type: 'J',
    rotations: [
      // █
      // ███
      [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
      ],
      // ██
      // █
      // █
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
      ],
      // ███
      //   █
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 1, col: 2 },
      ],
      //  █
      //  █
      // ██
      [
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 2, col: 0 },
        { row: 2, col: 1 },
      ],
    ],
  },

  /**
   * L-piece: 4 rotations
   */
  L: {
    type: 'L',
    rotations: [
      //   █
      // ███
      [
        { row: 0, col: 2 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
      ],
      // █
      // █
      // ██
      [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
        { row: 2, col: 1 },
      ],
      // ███
      // █
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
        { row: 1, col: 0 },
      ],
      // ██
      //  █
      //  █
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 1 },
        { row: 2, col: 1 },
      ],
    ],
  },
};

/** List of all tetromino types */
export const TETROMINO_TYPES: TetrominoType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** Get absolute cell positions given a tetromino, rotation index, and anchor position */
export function getAbsoluteCells(
  tetromino: Tetromino,
  rotationIndex: number,
  anchor: Cell
): Cell[] {
  const rotation = tetromino.rotations[rotationIndex];
  return rotation.map((cell) => ({
    row: anchor.row + cell.row,
    col: anchor.col + cell.col,
  }));
}
