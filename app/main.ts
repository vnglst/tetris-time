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

// Color mapping for digit tetrominos (lit cells)
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
const SPEED = 10;

const scaleMs = (baseMs: number): number => Math.max(0, Math.round(baseMs / SPEED));

// Animation timing (base values at SPEED = 1)
const BASE_DROP_DURATION = 250; // ms per row
const BASE_PIECE_DELAY = 350; // ms between pieces
const BASE_ROTATE_DURATION = 240; // ms per rotation step
const BASE_HARD_DROP_DURATION = 50; // ms per row once positioned
const BASE_HARD_DROP_JITTER = 25; // +/- ms
const BASE_DIGIT_START_JITTER_MAX = 300; // ms
const BASE_PIECE_DELAY_JITTER = 400; // +/- ms

const DROP_DURATION = scaleMs(BASE_DROP_DURATION);
const PIECE_DELAY = scaleMs(BASE_PIECE_DELAY);
const ROTATE_DURATION = scaleMs(BASE_ROTATE_DURATION);
const HARD_DROP_DURATION = scaleMs(BASE_HARD_DROP_DURATION);
const HARD_DROP_JITTER = scaleMs(BASE_HARD_DROP_JITTER);
const DIGIT_START_JITTER_MAX = scaleMs(BASE_DIGIT_START_JITTER_MAX);
const PIECE_DELAY_JITTER = scaleMs(BASE_PIECE_DELAY_JITTER);

class TetrisClock {
  private container: HTMLElement;
  private grid: HTMLElement | null = null;
  private colonElement: HTMLElement | null = null;
  private currentTime: { hours: number; minutes: number } | null = null;
  private isAnimating = false;
  private lockedCells: Set<string> = new Set();

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

  private randInt(min: number, max: number): number {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    return Math.floor(Math.random() * (hi - lo + 1)) + lo;
  }

  private jitter(base: number, plusMinus: number): number {
    return Math.max(0, base + this.randInt(-plusMinus, plusMinus));
  }

  private async updateTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Skip if time hasn't changed or already animating
    if (this.currentTime?.hours === hours && this.currentTime?.minutes === minutes) {
      return;
    }

    if (this.isAnimating) return;

    this.isAnimating = true;
    this.currentTime = { hours, minutes };

    try {
      // Generate tile results
      const seed = Date.now();
      const tileResult = tileTimeGrid(hours, minutes, { seed });
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
    await this.delay(this.randInt(0, DIGIT_START_JITTER_MAX));

    for (let i = 0; i < seqResult.sequence.length; i++) {
      const seqPiece = seqResult.sequence[i];
      await this.animatePieceDrop(seqPiece);
      await this.delay(this.jitter(PIECE_DELAY, PIECE_DELAY_JITTER));
    }
  }

  private async animatePieceDrop(seqPiece: SequencedPiece): Promise<void> {
    const piece = seqPiece.piece;
    // Digit pieces get colorful tetromino colors, background pieces get uniform dark blue
    const color = piece.isLit ? DIGIT_COLORS[piece.type] : BACKGROUND_COLOR;

    const tetromino = TETROMINOES[piece.type];
    let activeKeys = new Set<string>();

    const rotationCount = tetromino.rotations.length;
    const targetRotation = ((piece.rotationIndex % rotationCount) + rotationCount) % rotationCount;
    const startRotation = (() => {
      if (rotationCount <= 1) return targetRotation;
      // Pick any rotation that isn't the target so we always "rotate into" place.
      const options: number[] = [];
      for (let r = 0; r < rotationCount; r++) {
        if (r !== targetRotation) options.push(r);
      }
      return options[Math.floor(Math.random() * options.length)] ?? targetRotation;
    })();

    // We simulate the sequencer's step list so the piece occupies real cells as it moves.
    // This matches classic "block-wise" Tetris motion more closely than translating final cells.
    let currentAnchor = { row: piece.anchor.row, col: piece.anchor.col };
    let currentRotation = startRotation;

    // Derive a reasonable step timing for non-drop actions.
    const nudgeDuration = Math.max(scaleMs(40), Math.floor(DROP_DURATION / 3));
    const rotateDuration = Math.max(ROTATE_DURATION, nudgeDuration);

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

    // Spawn at the TOP of the visual playfield.
    // Solver coordinates map to the bottom area via FIELD_TOP_PADDING_ROWS, so using
    // row = -FIELD_TOP_PADDING_ROWS makes the piece visible at visual row 0.
    currentAnchor = {
      row: -FIELD_TOP_PADDING_ROWS,
      col: spawnStep?.col ?? currentAnchor.col,
    };
    currentRotation = startRotation;
    renderAt();
    await this.delay(nudgeDuration);

    // Rotate into the final orientation right after spawn.
    while (currentRotation !== targetRotation) {
      currentRotation = (currentRotation + 1) % rotationCount;
      renderAt();
      await this.delay(rotateDuration);
    }

    // Horizontal moves (use sequencer path, but keep row fixed while moving).
    for (const step of moveSteps) {
      currentAnchor = {
        row: currentAnchor.row,
        col: step.col ?? currentAnchor.col,
      };
      renderAt();
      await this.delay(nudgeDuration);
    }

    // Once correctly positioned (rotation + column), do a faster drop.
    const hardDropDuration = this.jitter(HARD_DROP_DURATION, HARD_DROP_JITTER);

    // Drop row-by-row from spawn row all the way to the final solver anchor row.
    for (let r = currentAnchor.row + 1; r <= piece.anchor.row; r++) {
      currentAnchor = { row: r, col: piece.anchor.col };
      renderAt();
      await this.delay(hardDropDuration);
    }

    // Lock
    currentAnchor = { row: piece.anchor.row, col: piece.anchor.col };
    renderAt();
    for (const key of activeKeys) {
      this.lockedCells.add(key);
    }
    activeKeys = new Set();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize the clock when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new TetrisClock("app");
});
