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
} from '../src/index';

// Color mapping for digit tetrominos (lit cells)
const DIGIT_COLORS: Record<string, string> = {
  I: '#77AAFF', // Fennel Flower
  O: '#FED340', // Daisy
  T: '#C48EFD', // Liliac
  S: '#21C36F', // Algal Fuel
  Z: '#FA6E79', // Begonia
  J: '#F37A48', // Mandarin
  L: '#77AAFF', // Fennel Flower (using same as I for 6 colors)
};

// Single color for background tetrominoes (unlit cells)
const BACKGROUND_COLOR = '#1a3a5c'; // Dark blue

// Animation timing
const DROP_DURATION = 150; // ms per row (slower drop)
const PIECE_DELAY = 200; // ms between pieces
const TRANSITION_DELAY = 500; // ms before starting new time

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
    this.container.innerHTML = '';
    this.container.className = 'clock-container';

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
    const grid = document.createElement('div');
    grid.className = 'digit-grid';
    grid.style.gridTemplateColumns = `repeat(${DIGIT_COLS}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${DIGIT_ROWS}, 1fr)`;

    // Create empty cells
    for (let row = 0; row < DIGIT_ROWS; row++) {
      for (let col = 0; col < DIGIT_COLS; col++) {
        const cell = document.createElement('div');
        cell.className = 'cell empty';
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        grid.appendChild(cell);
      }
    }

    return grid;
  }

  private createColon(): HTMLElement {
    const colon = document.createElement('div');
    colon.className = 'colon';
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

    const cells = grid.querySelectorAll('.cell');
    cells.forEach((cell) => {
      cell.className = 'cell empty';
      (cell as HTMLElement).style.backgroundColor = '';
      (cell as HTMLElement).style.opacity = '';
      (cell as HTMLElement).style.transform = '';
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
    cell.style.opacity = '1';
    cell.style.transform = '';
  }

  private setCellEmptyIfUnlocked(gridIndex: number, row: number, col: number) {
    const locked = this.lockedCellsByDigit[gridIndex];
    if (locked?.has(this.cellKey(row, col))) return;
    const cell = this.getCell(gridIndex, row, col);
    if (!cell) return;
    cell.className = 'cell empty';
    cell.style.backgroundColor = '';
    cell.style.opacity = '';
    cell.style.transform = '';
  }

  private async updateTime() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Skip if time hasn't changed or already animating
    if (
      this.currentTime?.hours === hours &&
      this.currentTime?.minutes === minutes
    ) {
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
      console.error('Error updating time:', error);
    } finally {
      this.isAnimating = false;
    }
  }

  private async animateAllDigits(
    tileResults: TileResult[],
    sequenceResults: SequenceResult[]
  ) {
    // Clear all grids first
    for (let i = 0; i < 4; i++) {
      this.clearGrid(i);
    }

    // Animate all digits in parallel
    const animations = sequenceResults.map((seqResult, digitIndex) =>
      this.animateDigit(digitIndex, seqResult)
    );

    await Promise.all(animations);
  }

  private async animateDigit(
    gridIndex: number,
    seqResult: SequenceResult
  ): Promise<void> {
    if (!seqResult.success) return;

    for (let i = 0; i < seqResult.sequence.length; i++) {
      const seqPiece = seqResult.sequence[i];
      await this.animatePieceDrop(gridIndex, seqPiece);
      await this.delay(PIECE_DELAY);
    }
  }

  private async animatePieceDrop(
    gridIndex: number,
    seqPiece: SequencedPiece
  ): Promise<void> {
    const piece = seqPiece.piece;
    // Digit pieces get colorful tetromino colors, background pieces get uniform dark blue
    const color = piece.isLit ? DIGIT_COLORS[piece.type] : BACKGROUND_COLOR;

    const tetromino = TETROMINOES[piece.type];
    const locked = this.lockedCellsByDigit[gridIndex];
    const activeKeys = new Set<string>();

    // We simulate the sequencer's step list so the piece occupies real cells as it moves.
    // This matches classic "block-wise" Tetris motion more closely than translating final cells.
    let currentAnchor = { row: piece.anchor.row, col: piece.anchor.col };
    let currentRotation = 0;

    // Derive a reasonable step timing for non-drop actions.
    const nudgeDuration = Math.max(40, Math.floor(DROP_DURATION / 3));

    const renderAt = () => {
      // Clear previous active cells (but never clear locked cells)
      for (const key of activeKeys) {
        const [r, c] = key.split(',').map(Number);
        if (Number.isFinite(r) && Number.isFinite(c)) {
          this.setCellEmptyIfUnlocked(gridIndex, r, c);
        }
      }
      activeKeys.clear();

      const absCells = getAbsoluteCells(tetromino, currentRotation, currentAnchor);
      for (const cell of absCells) {
        // Don't attempt to draw above the grid (negative rows)
        if (cell.row < 0) continue;
        if (cell.row >= DIGIT_ROWS) continue;
        if (cell.col < 0 || cell.col >= DIGIT_COLS) continue;

        const key = this.cellKey(cell.row, cell.col);
        activeKeys.add(key);
        this.setCellOccupied(gridIndex, cell.row, cell.col, piece.type, color);
      }
    };

    for (const step of seqPiece.steps) {
      switch (step.action) {
        case 'spawn': {
          currentAnchor = {
            row: step.row ?? currentAnchor.row,
            col: step.col ?? currentAnchor.col,
          };
          currentRotation = 0;
          renderAt();
          await this.delay(nudgeDuration);
          break;
        }
        case 'rotate': {
          currentRotation = (currentRotation + 1) % tetromino.rotations.length;
          renderAt();
          await this.delay(nudgeDuration);
          break;
        }
        case 'move': {
          currentAnchor = {
            row: currentAnchor.row,
            col: step.col ?? currentAnchor.col,
          };
          renderAt();
          await this.delay(nudgeDuration);
          break;
        }
        case 'drop': {
          currentAnchor = {
            row: step.row ?? currentAnchor.row,
            col: step.col ?? currentAnchor.col,
          };
          renderAt();
          await this.delay(DROP_DURATION);
          break;
        }
        case 'lock': {
          currentAnchor = {
            row: step.row ?? currentAnchor.row,
            col: step.col ?? currentAnchor.col,
          };
          // Render final position one last time.
          renderAt();

          // Convert current active cells to locked cells.
          for (const key of activeKeys) {
            locked?.add(key);
          }
          activeKeys.clear();
          break;
        }
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize the clock when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new TetrisClock('app');
});
