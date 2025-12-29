import anime from 'animejs';
import {
  tileTime,
  sequenceTime,
  DIGIT_ROWS,
  DIGIT_COLS,
  type TileResult,
  type SequenceResult,
  type SequencedPiece,
  type PlacedTetromino,
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

    const cells = grid.querySelectorAll('.cell');
    cells.forEach((cell) => {
      cell.className = 'cell empty';
      (cell as HTMLElement).style.backgroundColor = '';
    });
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

    // Get the cells this piece will occupy
    const cells: HTMLElement[] = [];
    for (const cellPos of piece.cells) {
      const cell = this.getCell(gridIndex, cellPos.row, cellPos.col);
      if (cell) cells.push(cell);
    }

    if (cells.length === 0) return;

    // Calculate drop distance (from top to final position)
    const minRow = Math.min(...piece.cells.map((c) => c.row));
    const dropDistance = minRow + 1; // +1 because we start above the grid

    // Animate the drop
    return new Promise((resolve) => {
      // Set initial state (transparent, above position)
      cells.forEach((cell) => {
        cell.style.backgroundColor = color;
        cell.style.opacity = '0';
        cell.style.transform = `translateY(-${dropDistance * 26}px)`;
        cell.className = `cell ${piece.type}`;
      });

      // Animate to final position
      anime({
        targets: cells,
        translateY: 0,
        opacity: 1,
        duration: DROP_DURATION * dropDistance,
        easing: 'easeOutQuad',
        complete: () => {
          cells.forEach((cell) => {
            cell.style.transform = '';
          });
          resolve();
        },
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Initialize the clock when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new TetrisClock('app');
});
