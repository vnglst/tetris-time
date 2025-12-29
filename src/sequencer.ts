import type {
  PlacedTetromino,
  TileResult,
  SequencedPiece,
  SequenceResult,
  PlacementStep,
  Cell,
} from './types';
import { TETROMINOES } from './tetrominoes';

/**
 * Get the bounding box of a piece's cells
 */
function getBoundingBox(cells: Cell[]): {
  minRow: number;
  maxRow: number;
  minCol: number;
  maxCol: number;
} {
  const rows = cells.map((c) => c.row);
  const cols = cells.map((c) => c.col);
  return {
    minRow: Math.min(...rows),
    maxRow: Math.max(...rows),
    minCol: Math.min(...cols),
    maxCol: Math.max(...cols),
  };
}

/**
 * Get the spawn position for a piece (centered at top)
 */
function getSpawnColumn(piece: PlacedTetromino, gridCols: number): number {
  const tetromino = TETROMINOES[piece.type];
  const rotation = tetromino.rotations[piece.rotationIndex];
  const width = Math.max(...rotation.map((c) => c.col)) + 1;

  // Center the piece at the top
  return Math.floor((gridCols - width) / 2);
}

/**
 * Check if a piece can be dropped from the top to its final position
 * given the current state of placed pieces
 */
function canDropPiece(
  piece: PlacedTetromino,
  placedPieces: Set<string>,
  grid: (PlacedTetromino | null)[][]
): boolean {
  // For each cell of the piece, check that all cells above it (in its column)
  // are either empty or belong to pieces not yet placed
  for (const cell of piece.cells) {
    for (let row = 0; row < cell.row; row++) {
      const cellAbove = grid[row]?.[cell.col];
      if (cellAbove && placedPieces.has(cellAbove.id)) {
        // There's an already-placed piece blocking the drop path
        return false;
      }
    }
  }
  return true;
}

/**
 * Generate the movement steps for placing a piece
 */
function generateSteps(
  piece: PlacedTetromino,
  gridCols: number,
  gridRows: number
): PlacementStep[] {
  const steps: PlacementStep[] = [];
  const tetromino = TETROMINOES[piece.type];
  const rotation = tetromino.rotations[piece.rotationIndex];

  // Calculate piece dimensions
  const pieceMinCol = Math.min(...rotation.map((c) => c.col));
  const pieceMaxCol = Math.max(...rotation.map((c) => c.col));
  const pieceMinRow = Math.min(...rotation.map((c) => c.row));
  const pieceWidth = pieceMaxCol - pieceMinCol + 1;
  const pieceHeight = Math.max(...rotation.map((c) => c.row)) - pieceMinRow + 1;

  // Spawn position (centered at top, above the grid)
  const spawnCol = Math.floor((gridCols - pieceWidth) / 2);
  const spawnRow = -pieceHeight; // Start above the grid

  // Target position (where the piece's anchor ends up)
  const targetCol = piece.anchor.col;
  const targetRow = piece.anchor.row;

  // Step 1: Spawn
  steps.push({
    action: 'spawn',
    row: spawnRow,
    col: spawnCol,
  });

  // Step 2: Rotate (if needed - we assume piece spawns in rotation 0)
  if (piece.rotationIndex > 0) {
    for (let r = 0; r < piece.rotationIndex; r++) {
      steps.push({ action: 'rotate' });
    }
  }

  // Step 3: Move horizontally to target column
  const horizontalDiff = targetCol - spawnCol;
  if (horizontalDiff !== 0) {
    const direction = horizontalDiff > 0 ? 'right' : 'left';
    const moveSteps = Math.abs(horizontalDiff);

    for (let m = 0; m < moveSteps; m++) {
      const currentCol = spawnCol + (direction === 'right' ? m + 1 : -(m + 1));
      steps.push({
        action: 'move',
        col: currentCol,
        direction,
      });
    }
  }

  // Step 4: Drop row by row
  for (let row = spawnRow + 1; row <= targetRow; row++) {
    steps.push({
      action: 'drop',
      row,
      col: targetCol,
    });
  }

  // Step 5: Lock in place
  steps.push({
    action: 'lock',
    row: targetRow,
    col: targetCol,
  });

  return steps;
}

/**
 * Check if a piece is "supported" - can rest on the floor or on already-placed pieces.
 * A piece is supported if its lowest cell in each column is either:
 * - At the bottom of the grid (row === maxRow), OR
 * - Has an already-placed cell directly below it
 */
function isPieceSupported(
  piece: PlacedTetromino,
  placedCells: Set<string>,
  maxRow: number
): boolean {
  // Find the lowest row for each column this piece occupies
  const columnLowestRows = new Map<number, number>();
  for (const cell of piece.cells) {
    const current = columnLowestRows.get(cell.col) ?? -1;
    if (cell.row > current) {
      columnLowestRows.set(cell.col, cell.row);
    }
  }

  // Check if each lowest cell is supported
  return [...columnLowestRows.entries()].every(([col, row]) => {
    if (row === maxRow) return true; // At bottom of grid
    const cellBelowKey = `${row + 1},${col}`;
    return placedCells.has(cellBelowKey); // Has placed cell below
  });
}

/**
 * Sequence the pieces from a tile result for Tetris-style animation.
 * Uses gravity-based ordering: pieces are placed in the order they would
 * naturally fall and land, starting with pieces that touch the bottom.
 */
export function sequencePieces(result: TileResult): SequenceResult {
  if (!result.success || result.pieces.length === 0) {
    return {
      success: false,
      sequence: [],
      rows: result.grid.length,
      cols: result.grid[0]?.length ?? 0,
    };
  }

  const gridRows = result.grid.length;
  const gridCols = result.grid[0]?.length ?? 0;
  const maxRow = gridRows - 1;

  // Track placed cells and remaining pieces
  const placedCells = new Set<string>();
  const remainingPieces = new Set(result.pieces.map((p) => p.id));
  const pieceMap = new Map(result.pieces.map((p) => [p.id, p]));
  const sequence: SequencedPiece[] = [];

  // Continue until all pieces are placed
  while (remainingPieces.size > 0) {
    // Find all pieces that can be placed (are supported)
    const supportedPieces: PlacedTetromino[] = [];

    for (const pieceId of remainingPieces) {
      const piece = pieceMap.get(pieceId)!;
      if (isPieceSupported(piece, placedCells, maxRow)) {
        // Also check that drop path is clear
        if (canDropPiece(piece, new Set(sequence.map((s) => s.piece.id)), result.grid)) {
          supportedPieces.push(piece);
        }
      }
    }

    if (supportedPieces.length === 0) {
      // No piece can be placed - sequence is impossible
      // Fall back to dependency-based ordering
      const fallbackResult = tryReorderForValidSequence(
        result.pieces,
        result.grid,
        gridRows,
        gridCols
      );
      if (fallbackResult) {
        return fallbackResult;
      }

      return {
        success: false,
        sequence: [],
        rows: gridRows,
        cols: gridCols,
      };
    }

    // Sort supported pieces: prefer pieces with lower cells (more towards bottom)
    // This ensures we fill from bottom up naturally
    supportedPieces.sort((a, b) => {
      const aMaxRow = Math.max(...a.cells.map((c) => c.row));
      const bMaxRow = Math.max(...b.cells.map((c) => c.row));
      if (aMaxRow !== bMaxRow) {
        return bMaxRow - aMaxRow; // Higher row (bottom) first
      }
      // Tie-breaker: leftmost column
      const aMinCol = Math.min(...a.cells.map((c) => c.col));
      const bMinCol = Math.min(...b.cells.map((c) => c.col));
      return aMinCol - bMinCol;
    });

    // Place the first supported piece
    const piece = supportedPieces[0];
    remainingPieces.delete(piece.id);

    // Add piece cells to placed set
    for (const cell of piece.cells) {
      placedCells.add(`${cell.row},${cell.col}`);
    }

    // Generate movement steps
    const steps = generateSteps(piece, gridCols, gridRows);

    sequence.push({
      piece,
      order: sequence.length,
      dropColumn: piece.anchor.col,
      steps,
    });
  }

  return {
    success: true,
    sequence,
    rows: gridRows,
    cols: gridCols,
  };
}

/**
 * Try to find a valid sequence order using topological sort.
 * A piece A must come before piece B if any cell of B is directly above any cell of A.
 */
function tryReorderForValidSequence(
  pieces: PlacedTetromino[],
  grid: (PlacedTetromino | null)[][],
  gridRows: number,
  gridCols: number
): SequenceResult | null {
  // Build dependency graph: piece A depends on piece B if B blocks A's drop path
  const dependencies = new Map<string, Set<string>>();
  const pieceMap = new Map<string, PlacedTetromino>();

  for (const piece of pieces) {
    dependencies.set(piece.id, new Set());
    pieceMap.set(piece.id, piece);
  }

  // For each piece, find which pieces are above it (in any column it occupies)
  for (const piece of pieces) {
    for (const cell of piece.cells) {
      // Check all cells above this cell in the same column
      for (let row = 0; row < cell.row; row++) {
        const cellAbove = grid[row]?.[cell.col];
        if (cellAbove && cellAbove.id !== piece.id) {
          // This piece depends on cellAbove's piece being placed first
          dependencies.get(piece.id)!.add(cellAbove.id);
        }
      }
    }
  }

  // Topological sort using Kahn's algorithm
  const inDegree = new Map<string, number>();
  for (const piece of pieces) {
    inDegree.set(piece.id, dependencies.get(piece.id)!.size);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  const sortedIds: string[] = [];
  while (queue.length > 0) {
    // Sort queue by row (bottom first) for consistent ordering
    queue.sort((a, b) => {
      const pieceA = pieceMap.get(a)!;
      const pieceB = pieceMap.get(b)!;
      const aMaxRow = Math.max(...pieceA.cells.map((c) => c.row));
      const bMaxRow = Math.max(...pieceB.cells.map((c) => c.row));
      return bMaxRow - aMaxRow;
    });

    const current = queue.shift()!;
    sortedIds.push(current);

    // Update in-degrees
    for (const [id, deps] of dependencies) {
      if (deps.has(current)) {
        deps.delete(current);
        const newDegree = inDegree.get(id)! - 1;
        inDegree.set(id, newDegree);
        if (newDegree === 0) {
          queue.push(id);
        }
      }
    }
  }

  // Check if we got all pieces (no cycles)
  if (sortedIds.length !== pieces.length) {
    return null; // Cycle detected, impossible to sequence
  }

  // Build the sequence
  const sequence: SequencedPiece[] = [];
  for (let i = 0; i < sortedIds.length; i++) {
    const piece = pieceMap.get(sortedIds[i])!;
    const steps = generateSteps(piece, gridCols, gridRows);

    sequence.push({
      piece,
      order: i,
      dropColumn: piece.anchor.col,
      steps,
    });
  }

  return {
    success: true,
    sequence,
    rows: gridRows,
    cols: gridCols,
  };
}

/**
 * Sequence a digit tile result
 */
export function sequenceDigit(result: TileResult): SequenceResult {
  return sequencePieces(result);
}

/**
 * Sequence multiple digit tile results (for a full time display)
 */
export function sequenceTime(results: TileResult[]): SequenceResult[] {
  return results.map((result) => sequencePieces(result));
}
