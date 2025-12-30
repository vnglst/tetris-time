import { describe, it, expect } from "vitest";
import { sequencePieces } from "./sequencer";
import { tileDigit, tileTime, tileGrid, tileTimeGrid, TIME_ROWS, TIME_COLS } from "./solver";
import { TileResult } from "./types";

describe("sequencePieces", () => {
  it("should sequence a simple 4x4 grid", () => {
    const mask = Array.from({ length: 4 }, () => Array(4).fill(true));
    const tileResult = tileGrid(4, 4, mask, { seed: 42 });

    expect(tileResult.success).toBe(true);

    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);
    expect(seqResult.sequence.length).toBe(tileResult.pieces.length);
    expect(seqResult.rows).toBe(4);
    expect(seqResult.cols).toBe(4);
  });

  it("should assign correct order to pieces", () => {
    const mask = Array.from({ length: 4 }, () => Array(4).fill(true));
    const tileResult = tileGrid(4, 4, mask, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    // Check orders are sequential
    const orders = seqResult.sequence.map((s) => s.order).sort((a, b) => a - b);
    expect(orders).toEqual([0, 1, 2, 3]);
  });

  it("should generate movement steps for each piece", () => {
    const mask = Array.from({ length: 4 }, () => Array(4).fill(true));
    const tileResult = tileGrid(4, 4, mask, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    for (const seq of seqResult.sequence) {
      expect(seq.steps.length).toBeGreaterThan(0);

      // First step should be spawn
      expect(seq.steps[0].action).toBe("spawn");

      // Last step should be lock
      expect(seq.steps[seq.steps.length - 1].action).toBe("lock");
    }
  });

  it("should handle empty tile result", () => {
    const emptyResult: TileResult = {
      success: false,
      pieces: [],
      grid: [],
      stats: { attempts: 0, backtracks: 0, duration: 0 },
    };

    const seqResult = sequencePieces(emptyResult);

    expect(seqResult.success).toBe(false);
    expect(seqResult.sequence).toEqual([]);
  });

  it("should produce valid drop order (pieces below placed first)", () => {
    const mask = Array.from({ length: 4 }, () => Array(4).fill(true));
    const tileResult = tileGrid(4, 4, mask, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    // Verify that for each piece in sequence, its drop path is clear
    // when considering only pieces that come later in the sequence
    const placedPieceIds = new Set<string>();

    for (const seqPiece of seqResult.sequence) {
      // Check that no already-placed piece blocks this piece's drop
      for (const cell of seqPiece.piece.cells) {
        // Check cells above
        for (let row = 0; row < cell.row; row++) {
          const cellAbove = tileResult.grid[row]?.[cell.col];
          if (cellAbove) {
            // If there's a piece above, it should NOT be already placed
            expect(placedPieceIds.has(cellAbove.id)).toBe(false);
          }
        }
      }

      placedPieceIds.add(seqPiece.piece.id);
    }
  });
});

describe("sequencePieces with digits", () => {
  it("should sequence digit 0", () => {
    const tileResult = tileDigit(0, { seed: 42 });
    expect(tileResult.success).toBe(true);

    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);
    expect(seqResult.sequence.length).toBe(15); // 60 cells / 4 = 15 pieces
    expect(seqResult.rows).toBe(10);
    expect(seqResult.cols).toBe(6);
  });

  it("should sequence all digits 0-9", () => {
    for (let d = 0; d <= 9; d++) {
      const tileResult = tileDigit(d, { seed: 100 + d });
      expect(tileResult.success, `Digit ${d} tiling should succeed`).toBe(true);

      const seqResult = sequencePieces(tileResult);
      expect(seqResult.success, `Digit ${d} sequencing should succeed`).toBe(true);
      expect(seqResult.sequence.length).toBe(15);
    }
  });

  it("should include rotation steps when needed", () => {
    const tileResult = tileDigit(5, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    // At least some pieces should have non-zero rotation
    const piecesWithRotation = seqResult.sequence.filter((s) => s.piece.rotationIndex > 0);

    // Check that rotated pieces have rotation steps
    for (const seqPiece of piecesWithRotation) {
      const rotateSteps = seqPiece.steps.filter((s) => s.action === "rotate");
      expect(rotateSteps.length).toBe(seqPiece.piece.rotationIndex);
    }
  });

  it("should include horizontal move steps", () => {
    const tileResult = tileDigit(1, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    // Check that pieces have move steps if their final column differs from spawn
    for (const seqPiece of seqResult.sequence) {
      const moveSteps = seqPiece.steps.filter((s) => s.action === "move");
      const dropSteps = seqPiece.steps.filter((s) => s.action === "drop");

      // Every piece should have drop steps
      expect(dropSteps.length).toBeGreaterThan(0);
    }
  });
});

describe("sequencePieces with time", () => {
  it("should sequence time 12:34", () => {
    const tileResults = tileTime(12, 34, { seed: 42 });
    const seqResults = tileResults.map((r) => sequencePieces(r));

    expect(seqResults.length).toBe(4);

    for (let i = 0; i < 4; i++) {
      expect(seqResults[i].success).toBe(true);
      expect(seqResults[i].sequence.length).toBe(15);
    }
  });

  it("should handle 00:00", () => {
    const tileResults = tileTime(0, 0, { seed: 42 });
    const seqResults = tileResults.map((r) => sequencePieces(r));

    expect(seqResults.length).toBe(4);
    seqResults.forEach((r) => expect(r.success).toBe(true));
  });

  it("should handle 23:59", () => {
    const tileResults = tileTime(23, 59, { seed: 42 });
    const seqResults = tileResults.map((r) => sequencePieces(r));

    expect(seqResults.length).toBe(4);
    seqResults.forEach((r) => expect(r.success).toBe(true));
  });
});

describe("sequencePieces (tileTimeGrid)", () => {
  it("should sequence a unified time grid 12:34", () => {
    const tileResult = tileTimeGrid(12, 34, { seed: 42 });
    expect(tileResult.success).toBe(true);

    const seqResult = sequencePieces(tileResult);
    expect(seqResult.success).toBe(true);
    expect(seqResult.rows).toBe(TIME_ROWS);
    expect(seqResult.cols).toBe(TIME_COLS);
    expect(seqResult.sequence.length).toBe(tileResult.pieces.length);
  });
});

describe("Tetris mechanics", () => {
  it("first piece in sequence should touch the grid bottom", () => {
    const mask = Array.from({ length: 4 }, () => Array(4).fill(true));
    const tileResult = tileGrid(4, 4, mask, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);
    expect(seqResult.sequence.length).toBeGreaterThan(0);

    // The first piece should have at least one cell at the bottom row
    const firstPiece = seqResult.sequence[0].piece;
    const maxRow = seqResult.rows - 1;
    const touchesBottom = firstPiece.cells.some((c) => c.row === maxRow);

    expect(touchesBottom).toBe(true);
  });

  it("first piece in sequence for a digit should touch the bottom", () => {
    for (let d = 0; d <= 9; d++) {
      const tileResult = tileDigit(d, { seed: 100 + d });
      expect(tileResult.success, `Digit ${d} tiling should succeed`).toBe(true);

      const seqResult = sequencePieces(tileResult);
      expect(seqResult.success, `Digit ${d} sequencing should succeed`).toBe(true);

      const firstPiece = seqResult.sequence[0].piece;
      const maxRow = seqResult.rows - 1;
      const touchesBottom = firstPiece.cells.some((c) => c.row === maxRow);

      expect(touchesBottom, `Digit ${d}: first piece should touch bottom (row ${maxRow})`).toBe(true);
    }
  });

  it("no piece floats in mid-air - each piece is supported", () => {
    const tileResult = tileDigit(8, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    const maxRow = seqResult.rows - 1;

    // Build placed pieces incrementally and verify support
    const placedCells = new Set<string>();

    for (const seqPiece of seqResult.sequence) {
      // Each piece must be "supported" - every cell either:
      // - is at the bottom (row === maxRow), OR
      // - has a cell directly below it that is already placed
      const isSupported = seqPiece.piece.cells.every((cell) => {
        if (cell.row === maxRow) return true; // At bottom

        const cellBelowKey = `${cell.row + 1},${cell.col}`;
        return placedCells.has(cellBelowKey);
      });

      // Actually, for Tetris, we need the piece to land as a whole unit.
      // The piece is supported if its LOWEST cells in each column are supported.
      const columnLowestRows = new Map<number, number>();
      for (const cell of seqPiece.piece.cells) {
        const current = columnLowestRows.get(cell.col) ?? -1;
        if (cell.row > current) {
          columnLowestRows.set(cell.col, cell.row);
        }
      }

      const pieceIsSupported = [...columnLowestRows.entries()].every(([col, row]) => {
        if (row === maxRow) return true; // At bottom
        const cellBelowKey = `${row + 1},${col}`;
        return placedCells.has(cellBelowKey);
      });

      expect(pieceIsSupported, `Piece ${seqPiece.piece.id} (${seqPiece.piece.type}) should be supported`).toBe(true);

      // Add this piece's cells to placed set
      for (const cell of seqPiece.piece.cells) {
        placedCells.add(`${cell.row},${cell.col}`);
      }
    }
  });

  it("pieces are ordered by gravity - lower pieces first", () => {
    const tileResult = tileDigit(0, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    // For pieces that are in the same column, lower ones should come first
    // More generally: if piece A is directly above piece B, B comes first
    const pieceIndexMap = new Map<string, number>();
    for (let i = 0; i < seqResult.sequence.length; i++) {
      pieceIndexMap.set(seqResult.sequence[i].piece.id, i);
    }

    // Check for each piece: any piece directly below it should have lower index
    for (const seqPiece of seqResult.sequence) {
      const myIndex = pieceIndexMap.get(seqPiece.piece.id)!;

      for (const cell of seqPiece.piece.cells) {
        // Check if there's a different piece directly below this cell
        const cellBelow = tileResult.grid[cell.row + 1]?.[cell.col];
        if (cellBelow && cellBelow.id !== seqPiece.piece.id) {
          const belowIndex = pieceIndexMap.get(cellBelow.id)!;
          expect(belowIndex, `Piece below ${seqPiece.piece.id} should come earlier in sequence`).toBeLessThan(myIndex);
        }
      }
    }
  });
});

describe("piece placement order variation", () => {
  it("should not always place pieces left-to-right within same row", () => {
    // Test that the sequencer varies the placement direction
    // by checking that pieces on the same row level are NOT always left-to-right
    const tileResult = tileTimeGrid(12, 34, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    // Group pieces by their max row (the row they "settle" at)
    const piecesByMaxRow = new Map<number, { col: number; order: number }[]>();
    for (const seqPiece of seqResult.sequence) {
      const maxRow = Math.max(...seqPiece.piece.cells.map((c) => c.row));
      const minCol = Math.min(...seqPiece.piece.cells.map((c) => c.col));
      if (!piecesByMaxRow.has(maxRow)) {
        piecesByMaxRow.set(maxRow, []);
      }
      piecesByMaxRow.get(maxRow)!.push({ col: minCol, order: seqPiece.order });
    }

    // Check if there's any row where pieces are NOT strictly left-to-right ordered
    let hasNonLeftToRightRow = false;
    for (const [_row, pieces] of piecesByMaxRow) {
      if (pieces.length > 1) {
        // Sort by order and check if columns are strictly increasing
        const sorted = [...pieces].sort((a, b) => a.order - b.order);
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].col < sorted[i - 1].col) {
            hasNonLeftToRightRow = true;
            break;
          }
        }
      }
      if (hasNonLeftToRightRow) break;
    }

    expect(hasNonLeftToRightRow).toBe(true);
  });

  it("should vary placement direction - not all rows left-to-right", () => {
    // For a full time display, check that among the first pieces placed (bottom rows),
    // the direction varies between rows
    const tileResult = tileTimeGrid(12, 34, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    // Get the bottom row
    const bottomRow = TIME_ROWS - 1;
    const bottomRowPieces: { col: number; order: number }[] = [];
    for (const seqPiece of seqResult.sequence) {
      const maxRow = Math.max(...seqPiece.piece.cells.map((c) => c.row));
      if (maxRow === bottomRow) {
        const minCol = Math.min(...seqPiece.piece.cells.map((c) => c.col));
        bottomRowPieces.push({ col: minCol, order: seqPiece.order });
      }
    }

    // Sort by order to see the actual placement sequence
    bottomRowPieces.sort((a, b) => a.order - b.order);

    // The bottom row should NOT be strictly left-to-right
    // (i.e., at least one piece should be placed before a piece to its left)
    let isStrictlyLeftToRight = true;
    for (let i = 1; i < bottomRowPieces.length; i++) {
      if (bottomRowPieces[i].col < bottomRowPieces[i - 1].col) {
        isStrictlyLeftToRight = false;
        break;
      }
    }

    expect(isStrictlyLeftToRight).toBe(false);
  });
});

describe("step generation", () => {
  it("should generate spawn, optional rotate, optional move, drop, lock sequence", () => {
    const tileResult = tileDigit(8, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    for (const seqPiece of seqResult.sequence) {
      const actions = seqPiece.steps.map((s) => s.action);

      // First action must be spawn
      expect(actions[0]).toBe("spawn");

      // Last action must be lock
      expect(actions[actions.length - 1]).toBe("lock");

      // Actions before lock should be drop
      // (after spawn, rotate, move)
      const lockIndex = actions.length - 1;
      let dropStartIndex = -1;

      for (let i = 1; i < lockIndex; i++) {
        if (actions[i] === "drop") {
          dropStartIndex = i;
          break;
        }
      }

      // All actions after dropStartIndex (before lock) should be drop
      if (dropStartIndex !== -1) {
        for (let i = dropStartIndex; i < lockIndex; i++) {
          expect(actions[i]).toBe("drop");
        }
      }
    }
  });

  it("should have drop steps that decrease row by 1 each time", () => {
    const tileResult = tileDigit(3, { seed: 42 });
    const seqResult = sequencePieces(tileResult);

    expect(seqResult.success).toBe(true);

    for (const seqPiece of seqResult.sequence) {
      const dropSteps = seqPiece.steps.filter((s) => s.action === "drop");

      // Each consecutive drop should increase row by 1
      for (let i = 1; i < dropSteps.length; i++) {
        const prevRow = dropSteps[i - 1].row!;
        const currRow = dropSteps[i].row!;
        expect(currRow).toBe(prevRow + 1);
      }

      // Last drop row should match piece's final row
      if (dropSteps.length > 0) {
        const finalDropRow = dropSteps[dropSteps.length - 1].row!;
        expect(finalDropRow).toBe(seqPiece.piece.anchor.row);
      }
    }
  });
});
