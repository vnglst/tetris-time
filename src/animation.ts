import type { SequenceResult } from "./types";
import { TETROMINOES } from "./tetrominoes";

export interface AnimationEstimateConfig {
  fieldTopPaddingRows: number;
  nudgeDurationMs: number;
  rotateDurationMs: number;
  /** Gravity interval: ms per row drop (now used for continuous gravity) */
  hardDropDurationMs: number;
  pieceDelayMs: number;
}

export function estimateAnimationDurationMs(seqResult: SequenceResult, config: AnimationEstimateConfig): number {
  if (!seqResult.success) return 0;

  let total = 0;

  for (const seqPiece of seqResult.sequence) {
    const piece = seqPiece.piece;
    const rotationCount = TETROMINOES[piece.type].rotations.length;
    const targetRotation = ((piece.rotationIndex % rotationCount) + rotationCount) % rotationCount;
    const rotateSteps = rotationCount <= 1 ? 0 : targetRotation;
    const moveSteps = seqPiece.steps.filter((s) => s.action === "move").length;

    // UI drops from row = -fieldTopPaddingRows to piece.anchor.row
    const rowsDropped = Math.max(0, piece.anchor.row + config.fieldTopPaddingRows);

    // With time-based gravity, actions (rotate/move) happen in parallel with falling.
    // The piece animation time is the MAX of gravity time vs action time.
    const gravityTime = rowsDropped * config.hardDropDurationMs;
    const totalActions = rotateSteps + moveSteps;
    const actionTime = totalActions * config.nudgeDurationMs;

    // Piece takes whichever is longer: falling or completing all actions
    total += Math.max(gravityTime, actionTime);

    // animateField adds a delay after every piece (including the last)
    total += config.pieceDelayMs;
  }

  return total;
}
