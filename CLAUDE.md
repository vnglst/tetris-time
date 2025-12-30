# CLAUDE.md

This file provides guidance for Claude Code when working on this project.

## Project Overview

Tetris Time is a clock that displays the current time (HH:MM) using Tetris gameplay. Tetrominoes fall from the top, rotate, move horizontally, and land to form digit patterns.

## Development Approach

### TDD (Test-Driven Development)

Always write tests first:

1. Write a failing test that describes the expected behavior
2. Implement the minimal code to make the test pass
3. Refactor while keeping tests green

### Running Tests

```bash
npm test          # Run all tests (single run)
npm run test:watch # Run tests in watch mode
npm run typecheck # TypeScript type checking
```

### Delivering Features

Before completing any feature or bug fix, always run:

1. `npm test` - All tests must pass
2. `npm run typecheck` - No type errors allowed

### Committing Changes

When the user asks to commit, use ALL user prompts from the conversation as the commit message (not a summary). Each prompt should be on its own line. Example:

```
Can you make sure it also displays on mobile and other screen sizes.

It needs a little more margin on iPhone 12 Pro when in landscape mode.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

## Architecture

### Core Library (`src/`)

- **types.ts** - TypeScript interfaces for all data structures
- **tetrominoes.ts** - 7 Tetris pieces with all rotations
- **digits.ts** - Binary masks for digits 0-9
- **grid.ts** - Grid class with placement logic and constraints
- **solver.ts** - Backtracking algorithm to tile grids with tetrominoes
- **sequencer.ts** - Determines piece drop order for valid Tetris gameplay
- **animation.ts** - Animation duration estimation utilities

### Frontend (`app/`)

- **main.ts** - TetrisClock class that renders and animates the clock

## Key Design Principles

### Tetris Mechanics

Pieces must follow real Tetris physics:

- Spawn at top of grid
- Fall due to gravity
- Land on floor OR on already-placed pieces
- First piece always lands at the bottom

Tests verify this in `src/sequencer.test.ts` under "Tetris mechanics".

### Coloring

- **Digit tetrominoes (lit)**: Colorful by type (I=blue, O=yellow, T=purple, etc.)
- **Background tetrominoes (unlit)**: Single uniform dark blue (#1a3a5c)

## File Naming Conventions

- Source files: `*.ts`
- Test files: `*.test.ts` (co-located with source)
- Use kebab-case for new files

## Common Commands

```bash
npm run dev       # Start dev server
npm run build     # Build for production
npm test          # Run tests
npm run typecheck # Type check without emitting
```

## Animation Speed

The `SPEED` constant in `app/main.ts` controls animation speed:

- `SPEED = 1` - Normal speed
- `SPEED = 2` - 2x faster
- `SPEED = 0.5` - 2x slower
