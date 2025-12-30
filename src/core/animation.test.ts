import { describe, it, expect } from "vitest";
import { tileTimeGrid, tileDigit } from "./solver";
import { sequencePieces } from "./sequencer";
import { estimateAnimationDurationMs } from "./animation";
import { TETROMINOES } from "./tetrominoes";

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

  it("hardDropDurationMs is unused (pieces hard-drop instantly after actions)", () => {
    // The actual animation hard-drops pieces instantly once all actions complete,
    // so hardDropDurationMs (gravity interval) has no effect on the estimate.
    const tile = tileDigit(8, { seed: 123 });
    expect(tile.success).toBe(true);
    const seq = sequencePieces(tile);
    expect(seq.success).toBe(true);

    const configA = {
      fieldTopPaddingRows: 10,
      nudgeDurationMs: 50,
      rotateDurationMs: 30,
      hardDropDurationMs: 4,
      pieceDelayMs: 100,
      thinkDurationMs: 0,
    };
    const configB = { ...configA, hardDropDurationMs: 500 }; // 125x difference

    const a = estimateAnimationDurationMs(seq, configA);
    const b = estimateAnimationDurationMs(seq, configB);

    // Changing hardDropDurationMs should have no effect
    expect(a).toBe(b);
  });

  it("should match actual animation behavior with hard drop", () => {
    // This test demonstrates the current bug: the estimate doesn't account for
    // the fact that pieces hard-drop instantly once all actions are complete.
    const tile = tileTimeGrid(12, 34, { seed: 42 });
    const seq = sequencePieces(tile);
    expect(seq.success).toBe(true);

    const FIELD_TOP_PADDING_ROWS = 10;
    const DROP_DURATION = 500; // gravity interval
    const PIECE_DELAY = 600;
    const THINK_DURATION = 300; // pause before actions start
    const nudgeDuration = Math.max(40, Math.floor(DROP_DURATION / 3)); // 166ms

    // Calculate what the actual animation does:
    // 1. THINK_DURATION pause before actions
    // 2. Actions (rotations + moves) at nudgeDuration intervals
    // 3. Hard drop (instant, just a few frames) once actions complete
    // 4. PIECE_DELAY between pieces
    let actualBehaviorMs = 0;
    for (const seqPiece of seq.sequence) {
      const piece = seqPiece.piece;
      const rotationCount = TETROMINOES[piece.type].rotations.length;
      const targetRotation = ((piece.rotationIndex % rotationCount) + rotationCount) % rotationCount;
      const rotateSteps = rotationCount <= 1 ? 0 : targetRotation;
      const moveSteps = seqPiece.steps.filter((s) => s.action === "move").length;
      const totalActions = rotateSteps + moveSteps;

      // Actual: THINK_DURATION + actions, then instant hard drop
      actualBehaviorMs += THINK_DURATION + totalActions * nudgeDuration;
      actualBehaviorMs += PIECE_DELAY;
    }

    // Current estimate (now with thinkDurationMs)
    const currentEstimate = estimateAnimationDurationMs(seq, {
      fieldTopPaddingRows: FIELD_TOP_PADDING_ROWS,
      nudgeDurationMs: nudgeDuration,
      rotateDurationMs: 400,
      hardDropDurationMs: DROP_DURATION,
      pieceDelayMs: PIECE_DELAY,
      thinkDurationMs: THINK_DURATION,
    });

    // Estimate should now match actual behavior
    expect(currentEstimate).toBe(actualBehaviorMs);
  });
});
