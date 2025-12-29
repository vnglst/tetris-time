import { describe, it, expect } from 'vitest';
import { TETROMINOES, TETROMINO_TYPES, getAbsoluteCells } from './tetrominoes';

describe('Tetromino Definitions', () => {
  it('should define all 7 tetromino types', () => {
    expect(Object.keys(TETROMINOES)).toHaveLength(7);
    expect(TETROMINOES).toHaveProperty('I');
    expect(TETROMINOES).toHaveProperty('O');
    expect(TETROMINOES).toHaveProperty('T');
    expect(TETROMINOES).toHaveProperty('S');
    expect(TETROMINOES).toHaveProperty('Z');
    expect(TETROMINOES).toHaveProperty('J');
    expect(TETROMINOES).toHaveProperty('L');
  });

  it('should have exactly 4 cells per rotation for all pieces', () => {
    for (const type of TETROMINO_TYPES) {
      const tetromino = TETROMINOES[type];
      for (let i = 0; i < tetromino.rotations.length; i++) {
        expect(
          tetromino.rotations[i],
          `${type} rotation ${i} should have 4 cells`
        ).toHaveLength(4);
      }
    }
  });

  it('should have correct rotation counts', () => {
    expect(TETROMINOES.I.rotations).toHaveLength(2); // Horizontal, Vertical
    expect(TETROMINOES.O.rotations).toHaveLength(1); // Square is symmetric
    expect(TETROMINOES.T.rotations).toHaveLength(4); // 4 orientations
    expect(TETROMINOES.S.rotations).toHaveLength(2); // 2 unique orientations
    expect(TETROMINOES.Z.rotations).toHaveLength(2); // 2 unique orientations
    expect(TETROMINOES.J.rotations).toHaveLength(4); // 4 orientations
    expect(TETROMINOES.L.rotations).toHaveLength(4); // 4 orientations
  });

  it('should have non-negative cell coordinates in each rotation', () => {
    for (const type of TETROMINO_TYPES) {
      const tetromino = TETROMINOES[type];
      for (let i = 0; i < tetromino.rotations.length; i++) {
        for (const cell of tetromino.rotations[i]) {
          expect(cell.row, `${type} rotation ${i} has negative row`).toBeGreaterThanOrEqual(0);
          expect(cell.col, `${type} rotation ${i} has negative col`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('should have unique cells within each rotation (no duplicates)', () => {
    for (const type of TETROMINO_TYPES) {
      const tetromino = TETROMINOES[type];
      for (let i = 0; i < tetromino.rotations.length; i++) {
        const cells = tetromino.rotations[i];
        const uniqueKeys = new Set(cells.map((c) => `${c.row},${c.col}`));
        expect(
          uniqueKeys.size,
          `${type} rotation ${i} has duplicate cells`
        ).toBe(4);
      }
    }
  });

  it('should match type property with the key', () => {
    for (const type of TETROMINO_TYPES) {
      expect(TETROMINOES[type].type).toBe(type);
    }
  });
});

describe('getAbsoluteCells', () => {
  it('should offset cells by anchor position', () => {
    const cells = getAbsoluteCells(TETROMINOES.O, 0, { row: 5, col: 3 });
    expect(cells).toEqual([
      { row: 5, col: 3 },
      { row: 5, col: 4 },
      { row: 6, col: 3 },
      { row: 6, col: 4 },
    ]);
  });

  it('should work with anchor at origin', () => {
    const cells = getAbsoluteCells(TETROMINOES.I, 0, { row: 0, col: 0 });
    expect(cells).toEqual([
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ]);
  });

  it('should handle vertical I-piece', () => {
    const cells = getAbsoluteCells(TETROMINOES.I, 1, { row: 2, col: 1 });
    expect(cells).toEqual([
      { row: 2, col: 1 },
      { row: 3, col: 1 },
      { row: 4, col: 1 },
      { row: 5, col: 1 },
    ]);
  });
});

describe('TETROMINO_TYPES', () => {
  it('should contain all 7 types', () => {
    expect(TETROMINO_TYPES).toHaveLength(7);
    expect(TETROMINO_TYPES).toContain('I');
    expect(TETROMINO_TYPES).toContain('O');
    expect(TETROMINO_TYPES).toContain('T');
    expect(TETROMINO_TYPES).toContain('S');
    expect(TETROMINO_TYPES).toContain('Z');
    expect(TETROMINO_TYPES).toContain('J');
    expect(TETROMINO_TYPES).toContain('L');
  });
});
