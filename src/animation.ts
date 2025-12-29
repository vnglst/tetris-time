import type { SequenceResult } from "./types";
import { TETROMINOES } from "./tetrominoes";

export interface AnimationEstimateConfig {
  fieldTopPaddingRows: number;
  nudgeDurationMs: number;
  rotateDurationMs: number;
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

    total += config.nudgeDurationMs; // after spawn
    total += rotateSteps * config.rotateDurationMs;
    total += moveSteps * config.nudgeDurationMs;
    total += rowsDropped * config.hardDropDurationMs;

    // animateField adds a delay after every piece (including the last)
    total += config.pieceDelayMs;
  }

  return total;
}
