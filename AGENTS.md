# AGENTS.md!!!

Vanilla JS Pac-Man clone. No build system, no dependencies, no test suite. `README.md`, code comments, and UI strings are in Spanish.

## Run

- Open `src/index.html` directly in a browser. There is no dev server, npm, lint, typecheck, or test command — do not invent one.

## Architecture (`src/`)

- `index.html` loads classic scripts in dependency order: `maze.js` → `game.js` → `render.js` → `main.js`. They are **not** ES modules; modules share state through `window.*` globals. Any new script must be added to `index.html` in the right order and assign its API onto `window`.
- `maze.js` — `MAZE` is a 31×28 tile grid parsed from strings (`#` wall, `.` dot, ` ` empty, `-` pen door), plus `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`. `MAZE` is pristine; `createGame()` copies it into `game.grid` so dots can be eaten without mutating the source.
- `game.js` — state and rules: `createGame`, `update`, `DIRS`. `render.js` reads the `DIRS` global for ghost eyes.
- `render.js` — canvas drawing (tile = 20px, canvas 560×620).
- `main.js` — `requestAnimationFrame` loop, keyboard input, start/win/lose overlay.

## Gameplay conventions (easy to break)

- Actors move on fractional cell positions. Direction changes and dot eating only happen at integer-aligned cells (`aligned()` tolerance `1e-3`); keep speeds compatible with grid alignment (`PACMAN_SPEED 0.125`, `GHOST_SPEED 0.1`).
- `pacman` is blocked by walls (1) and pen door (3); ghosts are blocked only by walls (1).
- Tunnel wrapping applies only on `TUNNEL_ROW` (14), not the whole grid.

## Style

- Match the existing style: single quotes, spaces inside parentheses/brackets (`moveGhost( game, g )`, `grid[ y ][ x ]`), `//` comments, Spanish comments and UI strings. No comments unless they add non-obvious context.

## Spec workflow

- Large features go through the installed `spec` skill, which writes specs to `specs/` (folder does not exist yet — start at `01-`). `spec-impl` implements an approved spec.
- `.agents/skills/` are external skills tracked by `skills-lock.json`; do not hand-edit them.
- This folder is not a git repo yet; the branch steps in `spec-impl` require `git init` first.
