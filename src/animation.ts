import type { SequenceResult } from "./types";
import { TETROMINOES } from "./tetrominoes";

export interface AnimationEstimateConfig {
  fieldTopPaddingRows: number;
  nudgeDurationMs: number;
  rotateDurationMs: number;
  /** Gravity interval: ms per row drop (now used for continuous gravity) */
  hardDropDurationMs: number;
  pieceDelayMs: number;
  /** Pause before actions start (human-like "thinking" delay) */
  thinkDurationMs?: number;
}

export function estimateAnimationDurationMs(seqResult: SequenceResult, config: AnimationEstimateConfig): number {
  if (!seqResult.success) return 0;

  const thinkDuration = config.thinkDurationMs ?? 0;
  let total = 0;

  for (const seqPiece of seqResult.sequence) {
    const piece = seqPiece.piece;
    const rotationCount = TETROMINOES[piece.type].rotations.length;
    const targetRotation = ((piece.rotationIndex % rotationCount) + rotationCount) % rotationCount;
    const rotateSteps = rotationCount <= 1 ? 0 : targetRotation;
    const moveSteps = seqPiece.steps.filter((s) => s.action === "move").length;
    const totalActions = rotateSteps + moveSteps;

    // The actual animation behavior:
    // 1. thinkDuration pause before actions start
    // 2. Actions (rotate/move) execute at nudgeDuration intervals
    // 3. Once all actions complete, piece hard-drops instantly to final position
    // So piece time = thinkDuration + totalActions * nudgeDuration
    const actionTime = thinkDuration + totalActions * config.nudgeDurationMs;

    total += actionTime;

    // animateField adds a delay after every piece (including the last)
    total += config.pieceDelayMs;
  }

  return total;
}
