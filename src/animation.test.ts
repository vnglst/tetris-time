import { describe, it, expect } from "vitest";
import { tileTimeGrid, tileDigit } from "./solver";
import { sequencePieces } from "./sequencer";
import { estimateAnimationDurationMs } from "./animation";

describe("estimateAnimationDurationMs", () => {
  it("returns 0 for unsuccessful sequences", () => {
    const ms = estimateAnimationDurationMs(
      { success: false, sequence: [], rows: 0, cols: 0 },
      {
        fieldTopPaddingRows: 10,
        nudgeDurationMs: 10,
        rotateDurationMs: 10,
        hardDropDurationMs: 10,
        pieceDelayMs: 10,
      }
    );
    expect(ms).toBe(0);
  });

  it("scales linearly with pieceDelayMs", () => {
    const tile = tileTimeGrid(12, 34, { seed: 42 });
    expect(tile.success).toBe(true);
    const seq = sequencePieces(tile);
    expect(seq.success).toBe(true);

    const base = estimateAnimationDurationMs(seq, {
      fieldTopPaddingRows: 10,
      nudgeDurationMs: 20,
      rotateDurationMs: 30,
      hardDropDurationMs: 10,
      pieceDelayMs: 0,
    });

    const delta = 7;
    const withDelay = estimateAnimationDurationMs(seq, {
      fieldTopPaddingRows: 10,
      nudgeDurationMs: 20,
      rotateDurationMs: 30,
      hardDropDurationMs: 10,
      pieceDelayMs: delta,
    });

    expect(withDelay - base).toBe(delta * seq.sequence.length);
  });

  it("scales linearly with hardDropDurationMs", () => {
    const tile = tileDigit(8, { seed: 123 });
    expect(tile.success).toBe(true);
    const seq = sequencePieces(tile);
    expect(seq.success).toBe(true);

    const configA = {
      fieldTopPaddingRows: 10,
      nudgeDurationMs: 0, // Zero so gravityTime always dominates actionTime
      rotateDurationMs: 30,
      hardDropDurationMs: 4,
      pieceDelayMs: 0,
    };
    const configB = { ...configA, hardDropDurationMs: 9 };

    const a = estimateAnimationDurationMs(seq, configA);
    const b = estimateAnimationDurationMs(seq, configB);

    // Each piece drops (anchor.row + padding) rows.
    const totalRowsDropped = seq.sequence.reduce(
      (sum, s) => sum + Math.max(0, s.piece.anchor.row + configA.fieldTopPaddingRows),
      0
    );

    expect(b - a).toBe((configB.hardDropDurationMs - configA.hardDropDurationMs) * totalRowsDropped);
  });
});
