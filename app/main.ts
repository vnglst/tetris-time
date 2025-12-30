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

// Animation speed multiplier (higher = faster, e.g. 2 = 2x faster)
// Can be configured via URL parameter: ?speed=5
const SPEED = (() => {
  const params = new URLSearchParams(window.location.search);
  const speedParam = params.get("speed");
  if (speedParam !== null) {
    const parsed = parseFloat(speedParam);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3;
})();

// Mode: 'clock' (default) or 'countdown' via ?mode=countdown
const MODE: ClockMode = getModeFromUrl();

// Target date for countdown mode via ?to=2025-01-01T00:00:00
const TARGET_DATE: Date | null = getTargetDateFromUrl();

// Minimum animation frame duration (1 frame at 60fps)
const FRAME_MS = 16;

// Scale timing by SPEED with optional minimum
const scale = (ms: number, min = FRAME_MS) => Math.max(min, Math.round(ms / SPEED));

// Animation timings (scaled by SPEED)
const DROP_DURATION = scale(500);      // ms per row during gravity fall
const PIECE_DELAY = scale(600, 0);     // ms between pieces
const ROTATE_DURATION = scale(400);    // ms per rotation step
const THINK_DURATION = scale(300, 0);  // ms pause before rotating

// Fixed timings (not affected by SPEED)
const DISPLAY_PAUSE = 5000;  // ms to show completed time before clearing
const ROW_CLEAR_DELAY = 60;  // ms between each row clearing
const FLASH_DURATION = 50;   // ms for each flash cycle

class TetrisClock {
  private container: HTMLElement;
  private grid: HTMLElement | null = null;
  private colonElement: HTMLElement | null = null;
  private currentTime: { hours: number; minutes: number } | null = null;
  private isAnimating = false;
  private lockedCells: Set<string> = new Set();
  private countdownFinished = false;
  private audio: HTMLAudioElement | null = null;
  private musicButton: HTMLButtonElement | null = null;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
    this.init();
    this.createMusicToggle();
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

    // Reposition colon on resize (handles orientation changes and responsive breakpoints)
    window.addEventListener("resize", () => this.positionColon());

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

    // Read CSS variables from the container for responsive sizing
    const styles = getComputedStyle(this.container);
    const CELL_PX = parseFloat(styles.getPropertyValue("--cell-size")) || 24;
    const GAP_PX = parseFloat(styles.getPropertyValue("--cell-gap")) || 2;
    const PADDING_PX = parseFloat(styles.getPropertyValue("--grid-padding")) || 8;
    const COLON_WIDTH_PX = parseFloat(styles.getPropertyValue("--colon-dot-size")) || 16;

    // Align colon vertically with the digit area (not the padded spawn area).
    // Digit rows occupy the bottom DIGIT_ROWS rows; padding is at the top.
    const digitAreaCenterRow = FIELD_TOP_PADDING_ROWS + (DIGIT_ROWS - 1) / 2;
    const y = PADDING_PX + digitAreaCenterRow * (CELL_PX + GAP_PX) + CELL_PX / 2;

    const x = PADDING_PX + colonCenterCol * (CELL_PX + GAP_PX) + CELL_PX / 2 - COLON_WIDTH_PX / 2;
    this.colonElement.style.left = `${x}px`;
    this.colonElement.style.top = `${y}px`;
  }

  private createMusicToggle() {
    // Create audio element
    this.audio = new Audio("/Korobeiniki.mp3");
    this.audio.loop = true;
    // Scale music speed: SPEED 1 ≈ 0.85x, SPEED 3 = 1x, max 1.5x
    this.audio.playbackRate = Math.min(1.5, Math.max(0.5, 1 + (SPEED - 3) / 14));

    // Create button
    this.musicButton = document.createElement("button");
    this.musicButton.className = "music-toggle";
    this.musicButton.setAttribute("aria-label", "Toggle music");
    this.updateMusicIcon(false);

    this.musicButton.addEventListener("click", () => this.toggleMusic());
    this.container.appendChild(this.musicButton);

    // Try to autoplay (may be blocked by browser)
    this.audio.play().then(() => {
      this.updateMusicIcon(true);
    }).catch(() => {
      // Autoplay blocked, user must click to start
    });
  }

  private toggleMusic() {
    if (!this.audio) return;

    if (this.audio.paused) {
      this.audio.play();
      this.updateMusicIcon(true);
    } else {
      this.audio.pause();
      this.updateMusicIcon(false);
    }
  }

  private updateMusicIcon(isPlaying: boolean) {
    if (!this.musicButton) return;

    if (isPlaying) {
      // Speaker with sound waves icon
      this.musicButton.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
        </svg>
      `;
    } else {
      // Speaker muted icon
      this.musicButton.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
        </svg>
      `;
    }
  }

  private showColon() {
    if (this.colonElement) {
      this.colonElement.classList.add("visible");
    }
  }

  private hideColon() {
    if (this.colonElement) {
      this.colonElement.classList.remove("visible");
    }
  }

  private getCell(row: number, col: number): HTMLElement | null {
    if (!this.grid) return null;
    return this.grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  private clearGrid() {
    const grid = this.grid;
    if (!grid) return;

    this.lockedCells.clear();
    this.hideColon();

    // Restart music from beginning if playing
    if (this.audio && !this.audio.paused) {
      this.audio.currentTime = 0;
    }

    // Batch all cell resets for single repaint
    const cells = grid.querySelectorAll(".cell");
    cells.forEach((cell) => {
      cell.className = "cell empty";
      (cell as HTMLElement).style.cssText = "";
    });
  }

  private cellKey(row: number, col: number): string {
    return `${row},${col}`;
  }

  private setCellOccupied(row: number, col: number, pieceType: string, color: string) {
    const cell = this.getCell(row, col);
    if (!cell) return;
    // Batch style changes using cssText for single repaint
    cell.className = `cell ${pieceType}`;
    cell.style.cssText = `background-color: ${color}; opacity: 1;`;
  }

  private setCellEmptyIfUnlocked(row: number, col: number) {
    if (this.lockedCells.has(this.cellKey(row, col))) return;
    const cell = this.getCell(row, col);
    if (!cell) return;
    // Batch style reset using cssText for single repaint
    cell.className = "cell empty";
    cell.style.cssText = "";
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

      // Use remaining time as seed so each minute gets a unique animation
      // (like clock mode where seed changes each minute)
      seed = TARGET_DATE.getTime() + targetHours * 60 + targetMinutes;

      if (countdown.finished) {
        this.countdownFinished = true;
      }

      logMessage = `[tetris-time] mode=countdown target=${TARGET_DATE.toISOString()} remaining=${this.formatHHMM(
        targetHours,
        targetMinutes
      )} finished=${countdown.finished}`;
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
        const nudgeDuration = Math.max(scale(40, FRAME_MS), Math.floor(DROP_DURATION / 3));
        const rotateDuration = Math.max(ROTATE_DURATION, nudgeDuration);
        estimatedMs = estimateAnimationDurationMs(previewSeq, {
          fieldTopPaddingRows: FIELD_TOP_PADDING_ROWS,
          nudgeDurationMs: nudgeDuration,
          rotateDurationMs: rotateDuration,
          hardDropDurationMs: DROP_DURATION,
          pieceDelayMs: PIECE_DELAY,
          thinkDurationMs: THINK_DURATION,
          minHardDropDelayMs: FRAME_MS,
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

      logMessage =
        `[tetris-time] speed=${SPEED} base=${this.formatHHMM(baseTime.getHours(), baseTime.getMinutes())} ` +
        `target=${this.formatHHMM(targetHours, targetMinutes)} completionAt=${completionAtStr} etaMs=${estimatedMs}`;
    }

    // Skip if we'd render the same target time again (clock mode only).
    // In countdown mode, keep animating continuously.
    if (
      MODE !== "countdown" &&
      this.currentTime?.hours === targetHours &&
      this.currentTime?.minutes === targetMinutes
    ) {
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
      // Immediately check for next animation instead of waiting for setInterval
      this.updateTime();
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

    // Show the colon after all pieces have dropped
    this.showColon();

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
    const actionDuration = Math.max(scale(40), Math.floor(DROP_DURATION / 3));
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
          await this.delay(FRAME_MS);
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

  /**
   * Frame-synced delay using requestAnimationFrame.
   * This ensures all visual updates happen at frame boundaries,
   * eliminating mid-frame updates that cause flickering.
   */
  private delay(ms: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (now - start >= ms) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  }

  private nextFrame(): Promise<number> {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }

  private async clearRowsAnimation(): Promise<void> {
    if (!this.grid) return;

    // Pause to let the user see the completed time
    await this.delay(DISPLAY_PAUSE);

    // Cache filled cells with their colors to avoid repeated DOM queries
    const filledCells: Array<{ cell: HTMLElement; color: string; row: number }> = [];
    for (let row = 0; row < FIELD_ROWS; row++) {
      for (let col = 0; col < FIELD_COLS; col++) {
        const cell = this.getCell(row, col);
        if (cell && !cell.classList.contains("empty")) {
          filledCells.push({ cell, color: cell.style.backgroundColor, row });
        }
      }
    }

    // Classic Tetris flash effect - blink all filled cells
    const flashCount = 4;
    for (let flash = 0; flash < flashCount; flash++) {
      // Flash to white - batch all updates
      for (const { cell } of filledCells) {
        cell.style.backgroundColor = "#ffffff";
      }
      await this.delay(FLASH_DURATION);

      // Flash back to original color - batch all updates
      for (const { cell, color } of filledCells) {
        cell.style.backgroundColor = color;
      }
      await this.delay(FLASH_DURATION);
    }

    // Group cells by row for efficient clearing
    const rowGroups = new Map<number, HTMLElement[]>();
    for (const { cell, row } of filledCells) {
      if (!rowGroups.has(row)) rowGroups.set(row, []);
      rowGroups.get(row)!.push(cell);
    }

    // Clear rows from bottom to top (classic Tetris style)
    const sortedRows = [...rowGroups.keys()].sort((a, b) => b - a);
    for (const row of sortedRows) {
      const cells = rowGroups.get(row)!;
      // Clear all cells in row with batched style reset
      for (const cell of cells) {
        cell.className = "cell empty";
        cell.style.cssText = "";
      }
      await this.delay(ROW_CLEAR_DELAY);
    }

    this.lockedCells.clear();
  }
}

// Initialize the clock when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new TetrisClock("app");
});
