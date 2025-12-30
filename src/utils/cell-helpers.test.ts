import { describe, it, expect } from "vitest";
import { cellKey, parseCellKey } from "./cell-helpers";

describe("cellKey", () => {
  it("should create a key from row and column", () => {
    expect(cellKey(5, 10)).toBe("5,10");
  });

  it("should handle zero values", () => {
    expect(cellKey(0, 0)).toBe("0,0");
  });

  it("should handle negative values", () => {
    expect(cellKey(-5, -10)).toBe("-5,-10");
  });

  it("should handle large values", () => {
    expect(cellKey(999, 888)).toBe("999,888");
  });

  it("should create unique keys for different positions", () => {
    const key1 = cellKey(1, 2);
    const key2 = cellKey(2, 1);
    const key3 = cellKey(1, 2);

    expect(key1).not.toBe(key2);
    expect(key1).toBe(key3);
  });
});

describe("parseCellKey", () => {
  it("should parse a valid cell key", () => {
    const result = parseCellKey("5,10");
    expect(result).toEqual({ row: 5, col: 10 });
  });

  it("should parse zero values", () => {
    const result = parseCellKey("0,0");
    expect(result).toEqual({ row: 0, col: 0 });
  });

  it("should parse negative values", () => {
    const result = parseCellKey("-5,-10");
    expect(result).toEqual({ row: -5, col: -10 });
  });

  it("should parse large values", () => {
    const result = parseCellKey("999,888");
    expect(result).toEqual({ row: 999, col: 888 });
  });

  it("should return null for invalid key with missing column", () => {
    const result = parseCellKey("5");
    expect(result).toBeNull();
  });

  it("should return null for invalid key with extra values", () => {
    const result = parseCellKey("5,10,15");
    expect(result).toBeNull();
  });

  it("should return null for non-numeric values", () => {
    const result = parseCellKey("abc,def");
    expect(result).toBeNull();
  });

  it("should return null for empty string", () => {
    const result = parseCellKey("");
    expect(result).toBeNull();
  });

  it("should return null for key with NaN values", () => {
    const result = parseCellKey("NaN,10");
    expect(result).toBeNull();
  });

  it("should be inverse of cellKey for valid inputs", () => {
    const row = 7;
    const col = 13;
    const key = cellKey(row, col);
    const parsed = parseCellKey(key);

    expect(parsed).toEqual({ row, col });
  });
});
