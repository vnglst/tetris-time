import {
  DIGIT_ROWS,
  DIGIT_COLS,
  TIME_COLS,
  TIME_DIGIT_GAP_COLS,
  TIME_COLON_GAP_COLS,
  tileTimeGrid,
  sequencePieces,
  type TileResult,
  type SequenceResult,
  type SequencedPiece,
  TETROMINOES,
  getAbsoluteCells,
} from "../src/index";
import { estimateAnimationDurationMs } from "../src/animation";
import { getModeFromUrl, getTargetDateFromUrl, getCountdownTime, type ClockMode } from "./countdown";

// Color mapping for digit tetrominos (lit cells)
// Colors from the Mindful Palette by Alex Cristache
// https://x.com/AlexCristache/status/2004124900748116212
const DIGIT_COLORS: Record<string, string> = {
  I: "#77AAFF", // Fennel Flower
  O: "#FED340", // Daisy
  T: "#C48EFD", // Liliac
  S: "#21C36F", // Algal Fuel
  Z: "#FA6E79", // Begonia
  J: "#F37A48", // Mandarin
  L: "#77AAFF", // Fennel Flower (using same as I for 6 colors)
};

// Single color for background tetrominoes (unlit cells)
const BACKGROUND_COLOR = "#1a3a5c"; // Dark blue

// Visual playfield sizing (keep digit solver size unchanged)
const FIELD_TOP_PADDING_ROWS = 10;
const FIELD_ROWS = DIGIT_ROWS + FIELD_TOP_PADDING_ROWS;

// Unified display sizing
const FIELD_COLS = TIME_COLS;
const DIGIT_GAP_COLS = TIME_DIGIT_GAP_COLS;
const COLON_GAP_COLS = TIME_COLON_GAP_COLS;

// Animation speed
// Increase to speed up everything (e.g. 2 = ~2x faster, 0.5 = ~2x slower).
// Can be configured via URL parameter: ?speed=5
const getSpeedFromUrl = (): number => {
  const params = new URLSearchParams(window.location.search);
  const speedParam = params.get("speed");
  if (speedParam !== null) {
    const parsed = parseFloat(speedParam);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 3; // default speed
};
const SPEED = getSpeedFromUrl();

// Mode configuration: 'clock' (default) or 'countdown'
// Can be configured via URL parameter: ?mode=countdown
const MODE: ClockMode = getModeFromUrl();

// Target date for countdown mode
// Can be configured via URL parameter: ?to=2025-01-01T00:00:00
const TARGET_DATE: Date | null = getTargetDateFromUrl();

const MIN_ANIM_STEP_MS = 16;
const scaleMs = (baseMs: number, minMs = 0): number => Math.max(minMs, Math.round(baseMs / SPEED));

// Animation timing (base values at SPEED = 1)
const BASE_DROP_DURATION = 500; // ms per row (gravity interval)
const BASE_PIECE_DELAY = 600; // ms between pieces
const BASE_ROTATE_DURATION = 400; // ms per rotation step
const BASE_THINK_DURATION = 300; // ms pause before rotating (human-like thinking)
const BASE_DISPLAY_PAUSE = 2000; // ms to display completed time before clearing
const BASE_ROW_CLEAR_DELAY = 80; // ms between each row clearing
const BASE_FLASH_DURATION = 100; // ms for each flash cycle
const MIN_HARD_DROP_DELAY = 16; // ms minimum delay per row during hard drop (ensures visibility)

const DROP_DURATION = scaleMs(BASE_DROP_DURATION, MIN_ANIM_STEP_MS);
const PIECE_DELAY = scaleMs(BASE_PIECE_DELAY, 0);
const ROTATE_DURATION = scaleMs(BASE_ROTATE_DURATION, MIN_ANIM_STEP_MS);
const THINK_DURATION = scaleMs(BASE_THINK_DURATION, 0);
const DISPLAY_PAUSE = scaleMs(BASE_DISPLAY_PAUSE, 0);
const ROW_CLEAR_DELAY = scaleMs(BASE_ROW_CLEAR_DELAY, MIN_ANIM_STEP_MS);
const FLASH_DURATION = scaleMs(BASE_FLASH_DURATION, MIN_ANIM_STEP_MS);

class TetrisClock {
  private container: HTMLElement;
  private grid: HTMLElement | null = null;
  private colonElement: HTMLElement | null = null;
  private currentTime: { hours: number; minutes: number } | null = null;
  private isAnimating = false;
  private lockedCells: Set<string> = new Set();
  private countdownFinished = false;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
    this.init();
  }

  private init() {
    this.container.innerHTML = "";
    this.container.className = "clock-container";

    // Single unified grid
    this.grid = this.createGrid(FIELD_COLS);
    this.container.appendChild(this.grid);

    // Colon overlay (still visual-only)
    this.colonElement = this.createColon();
    this.container.appendChild(this.colonElement);
    this.positionColon();

    // Start the clock
    this.updateTime();
    setInterval(() => this.updateTime(), 1000);
  }

  private createGrid(cols: number): HTMLElement {
    const grid = document.createElement("div");
    grid.className = "digit-grid";
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${FIELD_ROWS}, 1fr)`;

    // Create empty cells
    for (let row = 0; row < FIELD_ROWS; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = document.createElement("div");
        cell.className = "cell empty";
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        grid.appendChild(cell);
      }
    }

    return grid;
  }

  private createColon(): HTMLElement {
    const colon = document.createElement("div");
    colon.className = "colon";
    colon.innerHTML = '<div class="colon-dot"></div><div class="colon-dot"></div>';
    return colon;
  }

  private positionColon() {
    if (!this.colonElement) return;
    // Place colon in the middle of the HH|MM gap.
    // Layout: [d0][gap][d1][colonGap][d2][gap][d3]
    const colonGapStartCol = DIGIT_COLS * 2 + DIGIT_GAP_COLS;
    const colonCenterCol = colonGapStartCol + (COLON_GAP_COLS - 1) / 2;

    // Keep these in sync with CSS in index.html
    const CELL_PX = 24;
    const GAP_PX = 2;
    const PADDING_PX = 8;
    const COLON_WIDTH_PX = 16;

    // Align colon vertically with the digit area (not the padded spawn area).
    // Digit rows occupy the bottom DIGIT_ROWS rows; padding is at the top.
    const digitAreaCenterRow = FIELD_TOP_PADDING_ROWS + (DIGIT_ROWS - 1) / 2;
    const y = PADDING_PX + digitAreaCenterRow * (CELL_PX + GAP_PX) + CELL_PX / 2;

    const x = PADDING_PX + colonCenterCol * (CELL_PX + GAP_PX) + CELL_PX / 2 - COLON_WIDTH_PX / 2;
    this.colonElement.style.left = `${x}px`;
    this.colonElement.style.top = `${y}px`;
  }

  private getCell(row: number, col: number): HTMLElement | null {
    if (!this.grid) return null;
    return this.grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  private clearGrid() {
    const grid = this.grid;
    if (!grid) return;

    this.lockedCells.clear();

    const cells = grid.querySelectorAll(".cell");
    cells.forEach((cell) => {
      cell.className = "cell empty";
      (cell as HTMLElement).style.backgroundColor = "";
      (cell as HTMLElement).style.opacity = "";
      (cell as HTMLElement).style.transform = "";
    });
  }

  private cellKey(row: number, col: number): string {
    return `${row},${col}`;
  }

  private setCellOccupied(row: number, col: number, pieceType: string, color: string) {
    const cell = this.getCell(row, col);
    if (!cell) return;
    cell.className = `cell ${pieceType}`;
    cell.style.backgroundColor = color;
    cell.style.opacity = "1";
    cell.style.transform = "";
  }

  private setCellEmptyIfUnlocked(row: number, col: number) {
    if (this.lockedCells.has(this.cellKey(row, col))) return;
    const cell = this.getCell(row, col);
    if (!cell) return;
    cell.className = "cell empty";
    cell.style.backgroundColor = "";
    cell.style.opacity = "";
    cell.style.transform = "";
  }

  private formatHHMM(hours: number, minutes: number): string {
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  private floorToMinute(date: Date): Date {
    const d = new Date(date);
    d.setSeconds(0, 0);
    return d;
  }

  private async updateTime() {
    if (this.isAnimating) return;

    // In countdown mode, stop updating once countdown is finished
    if (this.countdownFinished) return;

    let targetHours: number;
    let targetMinutes: number;
    let seed: number;
    let logMessage: string;

    if (MODE === "countdown" && TARGET_DATE) {
      // Countdown mode: calculate time remaining
      const countdown = getCountdownTime(TARGET_DATE);
      targetHours = countdown.hours;
      targetMinutes = countdown.minutes;

      // Use target date as seed for deterministic rendering
      seed = TARGET_DATE.getTime();

      if (countdown.finished) {
        this.countdownFinished = true;
      }

      logMessage = `[tetris-time] mode=countdown target=${TARGET_DATE.toISOString()} remaining=${this.formatHHMM(targetHours, targetMinutes)} finished=${countdown.finished}`;
    } else {
      // Clock mode: use current time with fixed-point iteration
      const baseTime = this.floorToMinute(new Date());
      seed = baseTime.getTime();

      // Fixed-point iteration: target minute depends on the duration of animating that target.
      // This is especially important at slow speeds where animations span multiple minutes.
      let targetDate = new Date(baseTime);
      let estimatedMs = 0;
      for (let i = 0; i < 3; i++) {
        const h = targetDate.getHours();
        const m = targetDate.getMinutes();
        const previewTile = tileTimeGrid(h, m, { seed });
        const previewSeq = sequencePieces(previewTile);
        const nudgeDuration = Math.max(scaleMs(40, MIN_ANIM_STEP_MS), Math.floor(DROP_DURATION / 3));
        const rotateDuration = Math.max(ROTATE_DURATION, nudgeDuration);
        estimatedMs = estimateAnimationDurationMs(previewSeq, {
          fieldTopPaddingRows: FIELD_TOP_PADDING_ROWS,
          nudgeDurationMs: nudgeDuration,
          rotateDurationMs: rotateDuration,
          hardDropDurationMs: DROP_DURATION,
          pieceDelayMs: PIECE_DELAY,
          thinkDurationMs: THINK_DURATION,
          minHardDropDelayMs: MIN_HARD_DROP_DELAY,
        });

        const nextTarget = new Date(baseTime.getTime() + estimatedMs);
        if (nextTarget.getHours() === h && nextTarget.getMinutes() === m) {
          targetDate = nextTarget;
          break;
        }
        targetDate = nextTarget;
      }

      targetHours = targetDate.getHours();
      targetMinutes = targetDate.getMinutes();

      const completionAt = new Date(baseTime.getTime() + estimatedMs);
      const completionAtStr = this.formatHHMM(completionAt.getHours(), completionAt.getMinutes());

      logMessage = `[tetris-time] speed=${SPEED} base=${this.formatHHMM(baseTime.getHours(), baseTime.getMinutes())} ` +
        `target=${this.formatHHMM(targetHours, targetMinutes)} completionAt=${completionAtStr} etaMs=${estimatedMs}`;
    }

    // Skip if we'd render the same target time again.
    if (this.currentTime?.hours === targetHours && this.currentTime?.minutes === targetMinutes) {
      return;
    }

    this.isAnimating = true;
    this.currentTime = { hours: targetHours, minutes: targetMinutes };

    console.log(logMessage);

    try {
      // Solve + animate the target time.
      const extendedHours = MODE === "countdown";
      const tileResult = tileTimeGrid(targetHours, targetMinutes, { seed, extendedHours });
      const sequenceResult = sequencePieces(tileResult);

      // Animate one unified field
      await this.animateField(tileResult, sequenceResult);
    } catch (error) {
      console.error("Error updating time:", error);
    } finally {
      this.isAnimating = false;
    }
  }

  private async animateField(_tileResult: TileResult, seqResult: SequenceResult): Promise<void> {
    if (!seqResult.success) return;

    this.clearGrid();

    for (let i = 0; i < seqResult.sequence.length; i++) {
      const seqPiece = seqResult.sequence[i];
      await this.animatePieceDrop(seqPiece);
      await this.delay(PIECE_DELAY);
    }

    // Classic Tetris clear animation after time is fully displayed
    await this.clearRowsAnimation();
  }

  private async animatePieceDrop(seqPiece: SequencedPiece): Promise<void> {
    const piece = seqPiece.piece;
    // Digit pieces get colorful tetromino colors, background pieces get uniform dark blue
    const color = piece.isLit ? DIGIT_COLORS[piece.type] : BACKGROUND_COLOR;

    const tetromino = TETROMINOES[piece.type];
    let activeKeys = new Set<string>();

    const rotationCount = tetromino.rotations.length;
    const targetRotation = ((piece.rotationIndex % rotationCount) + rotationCount) % rotationCount;
    const startRotation = 0;

    // We simulate the sequencer's step list so the piece occupies real cells as it moves.
    // This matches classic "block-wise" Tetris motion more closely than translating final cells.
    let currentAnchor = { row: piece.anchor.row, col: piece.anchor.col };
    let currentRotation = startRotation;

    // Timing for actions (rotation/movement happen faster than gravity)
    const actionDuration = Math.max(scaleMs(40), Math.floor(DROP_DURATION / 3));
    // Gravity: piece falls 1 row per DROP_DURATION ms
    const gravityInterval = DROP_DURATION;

    const renderAt = () => {
      const nextKeys = new Set<string>();
      const absCells = getAbsoluteCells(tetromino, currentRotation, currentAnchor);

      for (const cell of absCells) {
        const visualRow = cell.row + FIELD_TOP_PADDING_ROWS;
        const visualCol = cell.col;

        if (visualRow < 0 || visualRow >= FIELD_ROWS) continue;
        if (visualCol < 0 || visualCol >= FIELD_COLS) continue;

        nextKeys.add(this.cellKey(visualRow, visualCol));
      }

      // Clear only cells we are leaving (avoids flicker on overlapping rotations)
      for (const key of activeKeys) {
        if (nextKeys.has(key)) continue;
        const [r, c] = key.split(",").map(Number);
        if (Number.isFinite(r) && Number.isFinite(c)) {
          this.setCellEmptyIfUnlocked(r, c);
        }
      }

      // Paint only newly occupied cells
      for (const key of nextKeys) {
        if (activeKeys.has(key)) continue;
        const [r, c] = key.split(",").map(Number);
        if (Number.isFinite(r) && Number.isFinite(c)) {
          this.setCellOccupied(r, c, piece.type, color);
        }
      }

      activeKeys = nextKeys;
    };

    const spawnStep = seqPiece.steps.find((s) => s.action === "spawn");
    const moveSteps = seqPiece.steps.filter((s) => s.action === "move");

    // Build action queue: rotations first, then horizontal moves
    type Action = { type: "rotate" } | { type: "move"; col: number };
    const actions: Action[] = [];

    // Queue rotation actions
    const rotationsNeeded = targetRotation; // startRotation is 0
    for (let i = 0; i < rotationsNeeded; i++) {
      actions.push({ type: "rotate" });
    }

    // Queue move actions
    for (const step of moveSteps) {
      if (step.col !== undefined) {
        actions.push({ type: "move", col: step.col });
      }
    }

    // Spawn at the TOP of the visual playfield.
    // Solver coordinates map to the bottom area via FIELD_TOP_PADDING_ROWS, so using
    // row = -FIELD_TOP_PADDING_ROWS makes the piece visible at visual row 0.
    currentAnchor = {
      row: -FIELD_TOP_PADDING_ROWS,
      col: spawnStep?.col ?? currentAnchor.col,
    };
    currentRotation = startRotation;
    renderAt();

    // Time-based animation loop: gravity runs continuously while actions execute
    const startTime = performance.now();
    let lastGravityTime = startTime;
    // Offset action time by THINK_DURATION to create a "thinking" pause before rotating
    let lastActionTime = startTime + THINK_DURATION;
    let actionIndex = 0;

    // Continue until piece reaches final row AND all actions are complete
    while (currentAnchor.row < piece.anchor.row || actionIndex < actions.length) {
      const now = await this.nextFrame();
      let stateChanged = false;

      // Apply gravity if enough time has passed and we haven't reached final row
      if (now - lastGravityTime >= gravityInterval && currentAnchor.row < piece.anchor.row) {
        currentAnchor = { row: currentAnchor.row + 1, col: currentAnchor.col };
        lastGravityTime = now;
        stateChanged = true;
      }

      // Execute next action if enough time has passed
      if (actionIndex < actions.length && now - lastActionTime >= actionDuration) {
        const action = actions[actionIndex];
        if (action.type === "rotate") {
          currentRotation = (currentRotation + 1) % rotationCount;
        } else if (action.type === "move") {
          currentAnchor = { ...currentAnchor, col: action.col };
        }
        actionIndex++;
        lastActionTime = now;
        stateChanged = true;
      }

      if (stateChanged) {
        renderAt();
      }

      // Hard drop: if piece is correctly positioned and rotated, drop immediately
      if (
        actionIndex >= actions.length &&
        currentAnchor.col === piece.anchor.col &&
        currentRotation === targetRotation
      ) {
        // Animate quick drop to final position with minimum visibility delay
        while (currentAnchor.row < piece.anchor.row) {
          currentAnchor = { row: currentAnchor.row + 1, col: currentAnchor.col };
          renderAt();
          await this.delay(MIN_HARD_DROP_DELAY);
        }
        break;
      }
    }

    // Lock at final position
    currentAnchor = { row: piece.anchor.row, col: piece.anchor.col };
    renderAt();
    for (const key of activeKeys) {
      this.lockedCells.add(key);
    }
    activeKeys = new Set();
  }

  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private nextFrame(): Promise<number> {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  private async clearRowsAnimation(): Promise<void> {
    if (!this.grid) return;

    // Pause to let the user see the completed time
    await this.delay(DISPLAY_PAUSE);

    // Store original colors before flashing
    const originalColors: Map<string, string> = new Map();
    for (let row = 0; row < FIELD_ROWS; row++) {
      for (let col = 0; col < FIELD_COLS; col++) {
        const cell = this.getCell(row, col);
        if (cell && !cell.classList.contains("empty")) {
          originalColors.set(this.cellKey(row, col), cell.style.backgroundColor);
        }
      }
    }

    // Classic Tetris flash effect - blink all filled cells
    const flashCount = 4;
    for (let flash = 0; flash < flashCount; flash++) {
      // Flash to white
      for (const [key] of originalColors) {
        const [row, col] = key.split(",").map(Number);
        const cell = this.getCell(row, col);
        if (cell) {
          cell.style.backgroundColor = "#ffffff";
        }
      }
      await this.delay(FLASH_DURATION);

      // Flash back to original color
      for (const [key, color] of originalColors) {
        const [row, col] = key.split(",").map(Number);
        const cell = this.getCell(row, col);
        if (cell) {
          cell.style.backgroundColor = color;
        }
      }
      await this.delay(FLASH_DURATION);
    }

    // Clear rows from bottom to top (classic Tetris style)
    for (let row = FIELD_ROWS - 1; row >= 0; row--) {
      let hasFilledCell = false;

      // Check if row has any filled cells
      for (let col = 0; col < FIELD_COLS; col++) {
        const cell = this.getCell(row, col);
        if (cell && !cell.classList.contains("empty")) {
          hasFilledCell = true;
          break;
        }
      }

      if (hasFilledCell) {
        // Clear this row with a quick animation
        for (let col = 0; col < FIELD_COLS; col++) {
          const cell = this.getCell(row, col);
          if (cell && !cell.classList.contains("empty")) {
            cell.className = "cell empty";
            cell.style.backgroundColor = "";
            cell.style.opacity = "";
            cell.style.transform = "";
          }
        }
        await this.delay(ROW_CLEAR_DELAY);
      }
    }

    this.lockedCells.clear();
  }
}

// Initialize the clock when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new TetrisClock("app");
});
