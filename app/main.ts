import {
  tileTime,
  sequenceTime,
  DIGIT_ROWS,
  DIGIT_COLS,
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

// Animation timing
const DROP_DURATION = 250; // ms per row
const PIECE_DELAY = 350; // ms between pieces
const ROTATE_DURATION = 240; // ms per rotation step

// Hard drop + de-sync jitter
const HARD_DROP_DURATION = 70; // ms per row once positioned
const HARD_DROP_JITTER = 25; // +/- ms
const DIGIT_START_JITTER_MAX = 500; // ms
const PIECE_DELAY_JITTER = 200; // +/- ms

class TetrisClock {
  private container: HTMLElement;
  private digitGrids: HTMLElement[] = [];
  private colonElement: HTMLElement | null = null;
  private currentTime: { hours: number; minutes: number } | null = null;
  private isAnimating = false;
  private lockedCellsByDigit: Set<string>[] = [];

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container ${containerId} not found`);
    this.container = container;
    this.init();
  }

  private init() {
    this.container.innerHTML = "";
    this.container.className = "clock-container";

    // Create 4 digit grids with colon in the middle
    for (let i = 0; i < 4; i++) {
      const grid = this.createDigitGrid();
      this.digitGrids.push(grid);
      this.lockedCellsByDigit.push(new Set());
      this.container.appendChild(grid);

      // Add colon after second digit
      if (i === 1) {
        this.colonElement = this.createColon();
        this.container.appendChild(this.colonElement);
      }
    }

    // Start the clock
    this.updateTime();
    setInterval(() => this.updateTime(), 1000);
  }

  private createDigitGrid(): HTMLElement {
    const grid = document.createElement("div");
    grid.className = "digit-grid";
    grid.style.gridTemplateColumns = `repeat(${DIGIT_COLS}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${FIELD_ROWS}, 1fr)`;

    // Create empty cells
    for (let row = 0; row < FIELD_ROWS; row++) {
      for (let col = 0; col < DIGIT_COLS; col++) {
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

  private getCell(gridIndex: number, row: number, col: number): HTMLElement | null {
    const grid = this.digitGrids[gridIndex];
    if (!grid) return null;
    return grid.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  }

  private clearGrid(gridIndex: number) {
    const grid = this.digitGrids[gridIndex];
    if (!grid) return;

    this.lockedCellsByDigit[gridIndex]?.clear();

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

  private setCellOccupied(gridIndex: number, row: number, col: number, pieceType: string, color: string) {
    const cell = this.getCell(gridIndex, row, col);
    if (!cell) return;
    cell.className = `cell ${pieceType}`;
    cell.style.backgroundColor = color;
    cell.style.opacity = "1";
    cell.style.transform = "";
  }

  private setCellEmptyIfUnlocked(gridIndex: number, row: number, col: number) {
    const locked = this.lockedCellsByDigit[gridIndex];
    if (locked?.has(this.cellKey(row, col))) return;
    const cell = this.getCell(gridIndex, row, col);
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
      const tileResults = tileTime(hours, minutes, { seed });
      const sequenceResults = sequenceTime(tileResults);

      // Animate each digit
      await this.animateAllDigits(tileResults, sequenceResults);
    } catch (error) {
      console.error("Error updating time:", error);
    } finally {
      this.isAnimating = false;
    }
  }

  private async animateAllDigits(tileResults: TileResult[], sequenceResults: SequenceResult[]) {
    // Clear all grids first
    for (let i = 0; i < 4; i++) {
      this.clearGrid(i);
    }

    // Animate all digits in parallel
    const animations = sequenceResults.map((seqResult, digitIndex) =>
      this.animateDigit(digitIndex, seqResult, this.randInt(0, DIGIT_START_JITTER_MAX))
    );

    await Promise.all(animations);
  }

  private async animateDigit(gridIndex: number, seqResult: SequenceResult, startDelayMs = 0): Promise<void> {
    if (!seqResult.success) return;

    if (startDelayMs > 0) {
      await this.delay(startDelayMs);
    }

    for (let i = 0; i < seqResult.sequence.length; i++) {
      const seqPiece = seqResult.sequence[i];
      await this.animatePieceDrop(gridIndex, seqPiece);
      await this.delay(this.jitter(PIECE_DELAY, PIECE_DELAY_JITTER));
    }
  }

  private async animatePieceDrop(gridIndex: number, seqPiece: SequencedPiece): Promise<void> {
    const piece = seqPiece.piece;
    // Digit pieces get colorful tetromino colors, background pieces get uniform dark blue
    const color = piece.isLit ? DIGIT_COLORS[piece.type] : BACKGROUND_COLOR;

    const tetromino = TETROMINOES[piece.type];
    const locked = this.lockedCellsByDigit[gridIndex];
    const activeKeys = new Set<string>();

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
    const nudgeDuration = Math.max(40, Math.floor(DROP_DURATION / 3));
    const rotateDuration = Math.max(ROTATE_DURATION, nudgeDuration);

    const renderAt = () => {
      // Clear previous active cells (but never clear locked cells)
      for (const key of activeKeys) {
        const [r, c] = key.split(",").map(Number);
        if (Number.isFinite(r) && Number.isFinite(c)) {
          this.setCellEmptyIfUnlocked(gridIndex, r, c);
        }
      }
      activeKeys.clear();

      const absCells = getAbsoluteCells(tetromino, currentRotation, currentAnchor);
      for (const cell of absCells) {
        const visualRow = cell.row + FIELD_TOP_PADDING_ROWS;
        const visualCol = cell.col;

        if (visualRow < 0 || visualRow >= FIELD_ROWS) continue;
        if (visualCol < 0 || visualCol >= DIGIT_COLS) continue;

        const key = this.cellKey(visualRow, visualCol);
        activeKeys.add(key);
        this.setCellOccupied(gridIndex, visualRow, visualCol, piece.type, color);
      }
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
      locked?.add(key);
    }
    activeKeys.clear();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize the clock when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new TetrisClock("app");
});
