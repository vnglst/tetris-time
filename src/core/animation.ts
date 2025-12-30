import type { SequenceResult } from "./types";
import { TETROMINOES } from "./tetrominoes";

export interface AnimationEstimateConfig {
  fieldTopPaddingRows: number;
  nudgeDurationMs: number;
  rotateDurationMs: number;
  /** Gravity interval: ms per row drop during action phase */
  hardDropDurationMs: number;
  pieceDelayMs: number;
  /** Pause before actions start (human-like "thinking" delay) */
  thinkDurationMs?: number;
  /** Minimum delay per row during hard drop phase (ensures visibility at high speeds) */
  minHardDropDelayMs?: number;
}

export function estimateAnimationDurationMs(seqResult: SequenceResult, config: AnimationEstimateConfig): number {
  if (!seqResult.success) return 0;

  const thinkDuration = config.thinkDurationMs ?? 0;
  const minHardDropDelay = config.minHardDropDelayMs ?? 0;
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
    // 3. During actions, gravity drops the piece at hardDropDurationMs intervals
    // 4. Once all actions complete, piece hard-drops to final position with minHardDropDelay per row
    const actionTime = thinkDuration + totalActions * config.nudgeDurationMs;

    // Calculate rows dropped by gravity during action phase
    const spawnRow = -config.fieldTopPaddingRows;
    const finalRow = piece.anchor.row;
    const totalDropDistance = finalRow - spawnRow;
    const rowsDroppedByGravity =
      config.hardDropDurationMs > 0 ? Math.min(Math.floor(actionTime / config.hardDropDurationMs), totalDropDistance) : 0;
    const rowsToHardDrop = Math.max(0, totalDropDistance - rowsDroppedByGravity);

    // Hard drop time (each row takes minHardDropDelay ms)
    const hardDropTime = rowsToHardDrop * minHardDropDelay;

    total += actionTime + hardDropTime;

    // animateField adds a delay after every piece (including the last)
    total += config.pieceDelayMs;
  }

  return total;
}
