import { describe, it, expect, beforeEach } from 'vitest';
import { Grid, resetPieceIdCounter } from './grid';
import { TETROMINOES } from './tetrominoes';

describe('Grid', () => {
  beforeEach(() => {
    resetPieceIdCounter();
  });

  describe('constructor', () => {
    it('should create a grid with specified dimensions', () => {
      const grid = new Grid(10, 6);
      expect(grid.rows).toBe(10);
      expect(grid.cols).toBe(6);
    });

    it('should start with all cells empty', () => {
      const grid = new Grid(4, 4);
      expect(grid.isFull()).toBe(false);
      expect(grid.findFirstEmpty()).toEqual({ row: 0, col: 0 });
    });
  });

  describe('canPlace', () => {
    it('should return true for valid placement in empty grid', () => {
      const grid = new Grid(4, 4);
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 0, col: 0 })).toBe(true);
    });

    it('should return false when out of bounds (right)', () => {
      const grid = new Grid(4, 4);
      // O-piece is 2x2, placing at col 3 would go to col 4 (out of bounds)
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 0, col: 3 })).toBe(false);
    });

    it('should return false when out of bounds (bottom)', () => {
      const grid = new Grid(4, 4);
      // O-piece is 2x2, placing at row 3 would go to row 4 (out of bounds)
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 3, col: 0 })).toBe(false);
    });

    it('should return false when out of bounds (negative)', () => {
      const grid = new Grid(4, 4);
      expect(grid.canPlace(TETROMINOES.O, 0, { row: -1, col: 0 })).toBe(false);
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 0, col: -1 })).toBe(false);
    });

    it('should return false when overlapping existing piece', () => {
      const grid = new Grid(4, 4);
      grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });

      // Try to place another piece overlapping
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 0, col: 1 })).toBe(false);
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 1, col: 0 })).toBe(false);
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 1, col: 1 })).toBe(false);
    });

    it('should return true when adjacent but not overlapping', () => {
      const grid = new Grid(4, 4);
      grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });

      // Place adjacent
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 0, col: 2 })).toBe(true);
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 2, col: 0 })).toBe(true);
    });

    it('should return false when crossing mask boundary', () => {
      const mask = [
        [true, true, false, false],
        [true, true, false, false],
        [true, true, false, false],
        [true, true, false, false],
      ];
      const grid = new Grid(4, 4, mask);

      // I-piece horizontal at (0,1) would span true and false cells
      expect(grid.canPlace(TETROMINOES.I, 0, { row: 0, col: 1 })).toBe(false);
    });

    it('should return true when all cells have same mask value', () => {
      const mask = [
        [true, true, false, false],
        [true, true, false, false],
        [false, false, true, true],
        [false, false, true, true],
      ];
      const grid = new Grid(4, 4, mask);

      // O-piece at (0,0) - all true
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 0, col: 0 })).toBe(true);
      // O-piece at (0,2) - all false
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 0, col: 2 })).toBe(true);
      // O-piece at (2,2) - all true
      expect(grid.canPlace(TETROMINOES.O, 0, { row: 2, col: 2 })).toBe(true);
    });

    it('should handle I-piece rotations', () => {
      const grid = new Grid(4, 4);

      // Horizontal I-piece (4 cols wide)
      expect(grid.canPlace(TETROMINOES.I, 0, { row: 0, col: 0 })).toBe(true);
      expect(grid.canPlace(TETROMINOES.I, 0, { row: 0, col: 1 })).toBe(false); // out of bounds

      // Vertical I-piece (4 rows tall)
      expect(grid.canPlace(TETROMINOES.I, 1, { row: 0, col: 0 })).toBe(true);
      expect(grid.canPlace(TETROMINOES.I, 1, { row: 1, col: 0 })).toBe(false); // out of bounds
    });
  });

  describe('place and remove', () => {
    it('should place a piece and return it', () => {
      const grid = new Grid(4, 4);
      const piece = grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });

      expect(piece.type).toBe('O');
      expect(piece.rotationIndex).toBe(0);
      expect(piece.anchor).toEqual({ row: 0, col: 0 });
      expect(piece.cells).toHaveLength(4);
      expect(piece.id).toBe('piece-1');
    });

    it('should mark cells as occupied after placement', () => {
      const grid = new Grid(4, 4);
      grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });

      const cells = grid.getCells();
      expect(cells[0][0]).not.toBeNull();
      expect(cells[0][1]).not.toBeNull();
      expect(cells[1][0]).not.toBeNull();
      expect(cells[1][1]).not.toBeNull();
      expect(cells[0][2]).toBeNull();
    });

    it('should throw when placing invalid piece', () => {
      const grid = new Grid(4, 4);
      expect(() => {
        grid.place(TETROMINOES.O, 0, { row: 3, col: 3 });
      }).toThrow();
    });

    it('should remove a piece', () => {
      const grid = new Grid(4, 4);
      const piece = grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });
      grid.remove(piece.id);

      const cells = grid.getCells();
      expect(cells[0][0]).toBeNull();
      expect(cells[0][1]).toBeNull();
      expect(cells[1][0]).toBeNull();
      expect(cells[1][1]).toBeNull();
    });

    it('should throw when removing non-existent piece', () => {
      const grid = new Grid(4, 4);
      expect(() => {
        grid.remove('non-existent');
      }).toThrow();
    });

    it('should set isLit based on mask value', () => {
      const mask = [
        [true, true, false, false],
        [true, true, false, false],
        [false, false, false, false],
        [false, false, false, false],
      ];
      const grid = new Grid(4, 4, mask);

      const litPiece = grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });
      expect(litPiece.isLit).toBe(true);

      const unlitPiece = grid.place(TETROMINOES.O, 0, { row: 0, col: 2 });
      expect(unlitPiece.isLit).toBe(false);
    });
  });

  describe('findFirstEmpty', () => {
    it('should return (0,0) for empty grid', () => {
      const grid = new Grid(4, 4);
      expect(grid.findFirstEmpty()).toEqual({ row: 0, col: 0 });
    });

    it('should skip filled cells', () => {
      const grid = new Grid(4, 4);
      grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });
      expect(grid.findFirstEmpty()).toEqual({ row: 0, col: 2 });
    });

    it('should return null for full grid', () => {
      const grid = new Grid(4, 4);
      // Fill with 4 O-pieces
      grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });
      grid.place(TETROMINOES.O, 0, { row: 0, col: 2 });
      grid.place(TETROMINOES.O, 0, { row: 2, col: 0 });
      grid.place(TETROMINOES.O, 0, { row: 2, col: 2 });

      expect(grid.findFirstEmpty()).toBeNull();
    });
  });

  describe('isFull', () => {
    it('should return false for empty grid', () => {
      const grid = new Grid(4, 4);
      expect(grid.isFull()).toBe(false);
    });

    it('should return false for partially filled grid', () => {
      const grid = new Grid(4, 4);
      grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });
      expect(grid.isFull()).toBe(false);
    });

    it('should return true for full grid', () => {
      const grid = new Grid(4, 4);
      grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });
      grid.place(TETROMINOES.O, 0, { row: 0, col: 2 });
      grid.place(TETROMINOES.O, 0, { row: 2, col: 0 });
      grid.place(TETROMINOES.O, 0, { row: 2, col: 2 });
      expect(grid.isFull()).toBe(true);
    });
  });

  describe('getPlacedPieces', () => {
    it('should return empty array for empty grid', () => {
      const grid = new Grid(4, 4);
      expect(grid.getPlacedPieces()).toEqual([]);
    });

    it('should return all placed pieces', () => {
      const grid = new Grid(4, 4);
      const piece1 = grid.place(TETROMINOES.O, 0, { row: 0, col: 0 });
      const piece2 = grid.place(TETROMINOES.O, 0, { row: 0, col: 2 });

      const pieces = grid.getPlacedPieces();
      expect(pieces).toHaveLength(2);
      expect(pieces).toContainEqual(piece1);
      expect(pieces).toContainEqual(piece2);
    });
  });

});
