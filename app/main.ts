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
import { getModeFromUrl, getTargetDateFromUrl, getCountdownTime, getNextNewYear, type ClockMode } from "./countdown";

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

// Get initial speed from URL parameter (default: 3)
const getInitialSpeed = (): number => {
  const params = new URLSearchParams(window.location.search);
  const speedParam = params.get("speed");
  if (speedParam !== null) {
    const parsed = parseFloat(speedParam);
    if (!isNaN(parsed) && parsed > 0) return Math.min(parsed, 10);
  }
  return 3;
};

// Get initial mode from URL parameter (default: 'clock')
const getInitialMode = (): ClockMode => getModeFromUrl();

// Get initial target date from URL parameter
const getInitialTargetDate = (): Date | null => getTargetDateFromUrl();

// Minimum animation frame duration (1 frame at 60fps)
const FRAME_MS = 16;

// Fixed timings (not affected by SPEED)
const DISPLAY_PAUSE = 5000; // ms to show completed time before clearing
const ROW_CLEAR_DELAY = 60; // ms between each row clearing
const FLASH_DURATION = 50; // ms for each flash cycle

class AnimationCancelled extends Error {
  constructor() {
    super("Animation cancelled");
    this.name = "AnimationCancelled";
  }
}

class TetrisClock {
  private container: HTMLElement;
  private grid: HTMLElement | null = null;
  private colonElement: HTMLElement | null = null;
  private currentTime: { hours: number; minutes: number } | null = null;
  private isAnimating = false;
  private lockedCells: Set<string> = new Set();
  private countdownFinished = false;
  private audio: HTMLAudioElement | null = null;
  private settingsMenu: HTMLElement | null = null;
  private settingsDropdown: HTMLElement | null = null;
  private isSettingsOpen = false;
  private animationToken = 0;

  // Dynamic settings
  private speed: number = getInitialSpeed();
  private mode: ClockMode = getInitialMode();
  private targetDate: Date | null = getInitialTargetDate();

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
    this.init();
    this.initAudio();
    this.createSettingsMenu();
  }

  private throwIfCancelled(token: number) {
    if (token !== this.animationToken) throw new AnimationCancelled();
  }

  private cancelCurrentAnimation(clear = true) {
    this.animationToken++;
    this.isAnimating = false;
    if (clear) this.clearGrid();
  }

  // Scale timing by speed with optional minimum
  private scale(ms: number, min = FRAME_MS): number {
    return Math.max(min, Math.round(ms / this.speed));
  }

  // Get animation timings (scaled by current speed)
  private get DROP_DURATION(): number {
    return this.scale(500);
  }
  private get PIECE_DELAY(): number {
    return this.scale(600, 0);
  }
  private get ROTATE_DURATION(): number {
    return this.scale(400);
  }
  private get THINK_DURATION(): number {
    return this.scale(300, 0);
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

  private initAudio() {
    this.audio = new Audio("/Korobeiniki.mp3");
    this.audio.loop = true;
    // Scale music speed: speed 1 ≈ 0.85x, speed 3 = 1x, max 1.5x
    this.audio.playbackRate = Math.min(1.5, Math.max(0.5, 1 + (this.speed - 3) / 14));

    // Try to autoplay (may be blocked by browser)
    this.audio.play().catch(() => {
      // Autoplay blocked, user must enable via settings
    });
  }

  private toggleMusic() {
    if (!this.audio) return;

    if (this.audio.paused) {
      this.audio.play();
    } else {
      this.audio.pause();
    }
  }

  private async setSoundEnabled(enabled: boolean) {
    if (!this.audio) return;

    if (enabled) {
      try {
        await this.audio.play();
      } catch {
        // Browser blocked playback; UI will remain "off"
      }
    } else {
      this.audio.pause();
    }

    this.updateSoundButtons();
  }

  private updateSoundButtons() {
    const isOn = !!this.audio && !this.audio.paused;
    const onBtn = this.settingsDropdown?.querySelector('[data-sound="on"]') as HTMLButtonElement | null;
    const offBtn = this.settingsDropdown?.querySelector('[data-sound="off"]') as HTMLButtonElement | null;
    if (!onBtn || !offBtn) return;
    if (isOn) {
      onBtn.classList.add("active");
      offBtn.classList.remove("active");
    } else {
      onBtn.classList.remove("active");
      offBtn.classList.add("active");
    }
  }

  private createSettingsMenu() {
    // Create menu container
    this.settingsMenu = document.createElement("div");
    this.settingsMenu.className = "settings-menu";

    // Create cog icon button
    const toggleButton = document.createElement("button");
    toggleButton.className = "settings-toggle";
    toggleButton.setAttribute("aria-label", "Toggle settings");
    toggleButton.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
      </svg>
    `;

    // Create dropdown
    this.settingsDropdown = document.createElement("div");
    this.settingsDropdown.className = "settings-dropdown";

    // Mode section
    const modeSection = document.createElement("div");
    modeSection.className = "settings-section";

    const modeLabel = document.createElement("span");
    modeLabel.className = "settings-label";
    modeLabel.textContent = "Mode";

    const modeButtons = document.createElement("div");
    modeButtons.className = "settings-buttons";

    const clockButton = document.createElement("button");
    clockButton.className = "settings-button";
    clockButton.textContent = "Clock";
    clockButton.dataset.mode = "clock";

    const countdownButton = document.createElement("button");
    countdownButton.className = "settings-button";
    countdownButton.textContent = "New Year";
    countdownButton.dataset.mode = "countdown";

    // Set active button
    if (this.mode === "clock") {
      clockButton.classList.add("active");
    } else {
      countdownButton.classList.add("active");
    }

    modeButtons.appendChild(clockButton);
    modeButtons.appendChild(countdownButton);
    modeSection.appendChild(modeLabel);
    modeSection.appendChild(modeButtons);

    // Speed section
    const speedSection = document.createElement("div");
    speedSection.className = "settings-section";

    const speedLabel = document.createElement("span");
    speedLabel.className = "settings-label";
    speedLabel.textContent = "Speed";

    const speedControls = document.createElement("div");
    speedControls.className = "speed-controls";

    const decreaseButton = document.createElement("button");
    decreaseButton.className = "speed-button";
    decreaseButton.textContent = "−";
    decreaseButton.disabled = this.speed <= 1;

    const speedValue = document.createElement("span");
    speedValue.className = "speed-value";
    speedValue.textContent = `${this.speed}x`;

    const increaseButton = document.createElement("button");
    increaseButton.className = "speed-button";
    increaseButton.textContent = "+";
    increaseButton.disabled = this.speed >= 10;

    speedControls.appendChild(decreaseButton);
    speedControls.appendChild(speedValue);
    speedControls.appendChild(increaseButton);
    speedSection.appendChild(speedLabel);
    speedSection.appendChild(speedControls);

    // Add sections to dropdown
    this.settingsDropdown.appendChild(modeSection);
    this.settingsDropdown.appendChild(speedSection);

    // Sound section
    const soundSection = document.createElement("div");
    soundSection.className = "settings-section";

    const soundLabel = document.createElement("span");
    soundLabel.className = "settings-label";
    soundLabel.textContent = "Sound";

    const soundButtons = document.createElement("div");
    soundButtons.className = "settings-buttons";

    const soundOnButton = document.createElement("button");
    soundOnButton.className = "settings-button";
    soundOnButton.textContent = "On";
    soundOnButton.dataset.sound = "on";

    const soundOffButton = document.createElement("button");
    soundOffButton.className = "settings-button";
    soundOffButton.textContent = "Off";
    soundOffButton.dataset.sound = "off";

    soundButtons.appendChild(soundOnButton);
    soundButtons.appendChild(soundOffButton);
    soundSection.appendChild(soundLabel);
    soundSection.appendChild(soundButtons);
    this.settingsDropdown.appendChild(soundSection);

    // Add toggle and dropdown to menu
    this.settingsMenu.appendChild(toggleButton);
    this.settingsMenu.appendChild(this.settingsDropdown);
    document.body.appendChild(this.settingsMenu);

    // Event listeners
    toggleButton.addEventListener("click", () => this.toggleSettings());

    clockButton.addEventListener("click", () => this.setMode("clock"));
    countdownButton.addEventListener("click", () => this.setMode("countdown"));

    decreaseButton.addEventListener("click", () => this.changeSpeed(-1));
    increaseButton.addEventListener("click", () => this.changeSpeed(1));

    soundOnButton.addEventListener("click", () => this.setSoundEnabled(true));
    soundOffButton.addEventListener("click", () => this.setSoundEnabled(false));

    // Initialize sound buttons state
    this.updateSoundButtons();

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (this.settingsMenu && !this.settingsMenu.contains(e.target as Node)) {
        this.closeSettings();
      }
    });
  }

  private toggleSettings() {
    this.isSettingsOpen = !this.isSettingsOpen;
    if (this.isSettingsOpen) {
      this.settingsDropdown?.classList.add("active");
      this.settingsMenu?.querySelector(".settings-toggle")?.classList.add("active");
    } else {
      this.closeSettings();
    }
  }

  private closeSettings() {
    this.isSettingsOpen = false;
    this.settingsDropdown?.classList.remove("active");
    this.settingsMenu?.querySelector(".settings-toggle")?.classList.remove("active");
  }

  private updateUrlParams() {
    const url = new URL(window.location.href);

    // Update mode parameter
    if (this.mode === "countdown") {
      url.searchParams.set("mode", "countdown");
      url.searchParams.set("to", "newyear");
    } else {
      url.searchParams.delete("mode");
      url.searchParams.delete("to");
    }

    // Update speed parameter
    if (this.speed !== 3) {
      url.searchParams.set("speed", this.speed.toString());
    } else {
      url.searchParams.delete("speed");
    }

    // Update URL without reloading the page
    window.history.replaceState({}, "", url.toString());
  }

  private setMode(mode: ClockMode) {
    if (this.mode === mode) return;

    // Cancel any in-flight animation and restart immediately.
    this.cancelCurrentAnimation(true);

    this.mode = mode;

    // Update target date for countdown mode
    if (mode === "countdown") {
      this.targetDate = getNextNewYear();
    } else {
      this.targetDate = null;
    }

    // Update button states
    const buttons = this.settingsDropdown?.querySelectorAll(".settings-button");
    buttons?.forEach((btn) => {
      const buttonMode = (btn as HTMLElement).dataset.mode;
      if (buttonMode === mode) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Update URL parameters
    this.updateUrlParams();

    // Reset countdown state and trigger immediate update
    this.countdownFinished = false;
    this.currentTime = null;
    this.updateTime();
  }

  private changeSpeed(delta: number) {
    const newSpeed = Math.max(1, Math.min(10, this.speed + delta));
    if (newSpeed === this.speed) return;

    this.speed = newSpeed;

    // Update music playback rate
    if (this.audio) {
      this.audio.playbackRate = Math.min(1.5, Math.max(0.5, 1 + (this.speed - 3) / 14));
    }

    // Update speed display
    const speedValue = this.settingsDropdown?.querySelector(".speed-value");
    if (speedValue) {
      speedValue.textContent = `${this.speed}x`;
    }

    // Update button states
    const decreaseButton = this.settingsDropdown?.querySelector(".speed-button:first-child") as HTMLButtonElement;
    const increaseButton = this.settingsDropdown?.querySelector(".speed-button:last-child") as HTMLButtonElement;

    if (decreaseButton) decreaseButton.disabled = this.speed <= 1;
    if (increaseButton) increaseButton.disabled = this.speed >= 10;

    // Update URL parameters
    this.updateUrlParams();

    // Trigger immediate update with new speed
    this.currentTime = null;
    this.updateTime();
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

    const token = this.animationToken;

    // In countdown mode, stop updating once countdown is finished
    if (this.countdownFinished) return;

    let targetHours: number;
    let targetMinutes: number;
    let seed: number;
    let logMessage: string;

    if (this.mode === "countdown" && this.targetDate) {
      // Countdown mode: calculate time remaining
      const countdown = getCountdownTime(this.targetDate);
      targetHours = countdown.hours;
      targetMinutes = countdown.minutes;

      // Use remaining time as seed so each minute gets a unique animation
      // (like clock mode where seed changes each minute)
      seed = this.targetDate.getTime() + targetHours * 60 + targetMinutes;

      if (countdown.finished) {
        this.countdownFinished = true;
      }

      logMessage = `[tetris-time] mode=countdown target=${this.targetDate.toISOString()} remaining=${this.formatHHMM(
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
        const nudgeDuration = Math.max(this.scale(40, FRAME_MS), Math.floor(this.DROP_DURATION / 3));
        const rotateDuration = Math.max(this.ROTATE_DURATION, nudgeDuration);
        estimatedMs = estimateAnimationDurationMs(previewSeq, {
          fieldTopPaddingRows: FIELD_TOP_PADDING_ROWS,
          nudgeDurationMs: nudgeDuration,
          rotateDurationMs: rotateDuration,
          hardDropDurationMs: this.DROP_DURATION,
          pieceDelayMs: this.PIECE_DELAY,
          thinkDurationMs: this.THINK_DURATION,
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
        `[tetris-time] speed=${this.speed} base=${this.formatHHMM(baseTime.getHours(), baseTime.getMinutes())} ` +
        `target=${this.formatHHMM(targetHours, targetMinutes)} completionAt=${completionAtStr} etaMs=${estimatedMs}`;
    }

    // Skip if we'd render the same target time again (clock mode only).
    // In countdown mode, keep animating continuously.
    if (
      this.mode !== "countdown" &&
      this.currentTime?.hours === targetHours &&
      this.currentTime?.minutes === targetMinutes
    ) {
      return;
    }

    this.isAnimating = true;
    this.currentTime = { hours: targetHours, minutes: targetMinutes };

    console.log(logMessage);

    try {
      this.throwIfCancelled(token);
      // Solve + animate the target time.
      const extendedHours = this.mode === "countdown";
      const tileResult = tileTimeGrid(targetHours, targetMinutes, { seed, extendedHours });
      const sequenceResult = sequencePieces(tileResult);

      // Animate one unified field
      await this.animateField(tileResult, sequenceResult, token);
    } catch (error) {
      if (error instanceof AnimationCancelled) {
        return;
      }
      console.error("Error updating time:", error);
    } finally {
      // If a newer animation has started/cancelled, don't enqueue work.
      if (token !== this.animationToken) return;
      this.isAnimating = false;
      // Immediately check for next animation instead of waiting for setInterval
      this.updateTime();
    }
  }

  private async animateField(_tileResult: TileResult, seqResult: SequenceResult, token: number): Promise<void> {
    if (!seqResult.success) return;

    this.throwIfCancelled(token);

    this.clearGrid();

    for (let i = 0; i < seqResult.sequence.length; i++) {
      this.throwIfCancelled(token);
      const seqPiece = seqResult.sequence[i];
      await this.animatePieceDrop(seqPiece, token);
      await this.delay(this.PIECE_DELAY, token);
    }

    this.throwIfCancelled(token);

    // Show the colon after all pieces have dropped
    this.showColon();

    // Classic Tetris clear animation after time is fully displayed
    await this.clearRowsAnimation(token);
  }

  private async animatePieceDrop(seqPiece: SequencedPiece, token: number): Promise<void> {
    this.throwIfCancelled(token);
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
    const actionDuration = Math.max(this.scale(40), Math.floor(this.DROP_DURATION / 3));
    // Gravity: piece falls 1 row per DROP_DURATION ms
    const gravityInterval = this.DROP_DURATION;

    const renderAt = () => {
      if (token !== this.animationToken) return;
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
    let lastActionTime = startTime + this.THINK_DURATION;
    let actionIndex = 0;

    // Continue until piece reaches final row AND all actions are complete
    while (currentAnchor.row < piece.anchor.row || actionIndex < actions.length) {
      const now = await this.nextFrame(token);
      this.throwIfCancelled(token);
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
          this.throwIfCancelled(token);
          currentAnchor = { row: currentAnchor.row + 1, col: currentAnchor.col };
          renderAt();
          await this.delay(FRAME_MS, token);
        }
        break;
      }
    }

    this.throwIfCancelled(token);

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
  private delay(ms: number, token?: number): Promise<void> {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (token !== undefined && token !== this.animationToken) {
          reject(new AnimationCancelled());
          return;
        }
        if (now - start >= ms) {
          resolve();
        } else {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    });
  }

  private nextFrame(token?: number): Promise<number> {
    return new Promise((resolve, reject) => {
      requestAnimationFrame((now) => {
        if (token !== undefined && token !== this.animationToken) {
          reject(new AnimationCancelled());
          return;
        }
        resolve(now);
      });
    });
  }

  private async clearRowsAnimation(token: number): Promise<void> {
    if (!this.grid) return;

    this.throwIfCancelled(token);

    // Pause to let the user see the completed time
    await this.delay(DISPLAY_PAUSE, token);

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
      this.throwIfCancelled(token);
      // Flash to white - batch all updates
      for (const { cell } of filledCells) {
        cell.style.backgroundColor = "#ffffff";
      }
      await this.delay(FLASH_DURATION, token);

      // Flash back to original color - batch all updates
      for (const { cell, color } of filledCells) {
        cell.style.backgroundColor = color;
      }
      await this.delay(FLASH_DURATION, token);
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
      this.throwIfCancelled(token);
      const cells = rowGroups.get(row)!;
      // Clear all cells in row with batched style reset
      for (const cell of cells) {
        cell.className = "cell empty";
        cell.style.cssText = "";
      }
      await this.delay(ROW_CLEAR_DELAY, token);
    }

    this.lockedCells.clear();
  }
}

// Initialize the clock when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new TetrisClock("app");
});
