/**
 * Grid cell position utilities
 */

/**
 * Creates a unique key for a cell position in the grid.
 * Used for tracking locked cells in a Set.
 *
 * @param row - Row index
 * @param col - Column index
 * @returns Cell key in format "row,col" (e.g., "5,10")
 */
export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

/**
 * Parses a cell key back into row and column numbers.
 *
 * @param key - Cell key in format "row,col"
 * @returns Object with row and col properties, or null if invalid
 */
export function parseCellKey(key: string): { row: number; col: number } | null {
  const parts = key.split(",");

  // Must have exactly 2 parts
  if (parts.length !== 2) {
    return null;
  }

  const [rowStr, colStr] = parts;
  const row = Number(rowStr);
  const col = Number(colStr);

  if (Number.isFinite(row) && Number.isFinite(col)) {
    return { row, col };
  }
  return null;
}
