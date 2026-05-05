# AGENTS.md — minigame

Vanilla-JS side-scrolling platformer (no build step). Source lives in `src/` and is loaded via `<script>` tags in `super.html` in dependency order.

## File map

| File | Purpose |
|------|---------|
| `src/engine.js` | Canvas setup, `drawSprite` / `drawSpriteHi`, `cameraScale`, `Input`, mobile touch zones. Exports `window.ENGINE`. |
| `src/sprites.js` | `PALETTE` and `SPRITES` — pixel-art grids (2D char arrays). |
| `src/levels.js` | `LEVELS` array. Each entry has `rows` (string grid), `theme`, `code`, `name`, `timeLimit`, `subtitle`. |
| `src/audio.js` | Web Audio synth. `window.AUDIO` with `unlock()`, `playSfx(name)`, `playLevelTrack(idx)`, `stop()`. |
| `src/game.js` | Game loop, physics, enemies, camera, HUD, name entry, score submission, win/lose flow. Reads `window.ENGINE`, `window.AUDIO`, `LEVELS`, `SPRITES`. |
| `leaderboard.html` | 16bit top-50 scoreboard page. Loads `/api/minigame/scores` when served by Nuxt. |
| `sprites.html` | Dev gallery — renders every sprite from `SPRITES` for visual QA. |

## Coordinate system

- Logical pixel = 1 unit. Tile = 16×16 logical px.
- `cameraScale()` = canvas pixels per logical pixel (integer ≥ 2, recomputed each frame).
- World coords are absolute. Camera offsets are in `camera.{x,y}`. Draw sprites with `_drawSprite(spr, worldX, worldY, camera)`.

## Tile grid in levels

```
'.'  sky/empty     '#'  ground      '='  brick
'?'  question      'U'  used        'o'  coin
'1'  Bloop         '2'  Sproink     '3'  Chomper
'S'  player start  'P'  princess    'F'  flag
'c'  cloud decor   'b'  bush decor  'h'  hill decor
```

Level height is always 14 rows; width is variable. Camera scrolls horizontally only.

## Key game constants (game.js)

`GRAVITY 0.42` · `MAX_FALL 10` · `RUN_MAX 3.4` · `JUMP_V -8.6` · `JUMP_HOLD -0.32`

## Mobile controls

- Coarse pointers/small screens show a gamepad-style control layout.
- The left thumb cluster contains both left and right movement arrows.
- The right thumb button is jump, so movement and jump can be combined with separate fingers.
- Mobile audio is unlocked from pointer/touch/key gestures. The iOS path starts the first Web Audio source synchronously inside the gesture, gameplay gestures retry the current level track, and the mobile audio button stays visible while the browser still requires an explicit audio gesture or the current track is not active.

## Score flow

- Player select is followed by `#name-entry`, an arcade-style player-name screen.
- Player names are normalized to uppercase, 2-12 chars, and allow letters, numbers, space, apostrophe, and hyphen.
- When served through Nuxt, `src/game.js` calls `/api/minigame/session` before starting a run and `/api/minigame/scores` after the final rescue.
- If the run reaches the final rescue without a valid score token, `src/game.js` retries session creation before falling back to local-only, and transient final-score submit failures retry in-place.
- Direct `file://` play still works, but scores are local-only because the Nuxt API is unavailable.
- Final score formula is `10000 + coins * 100 + ceil(timeRemaining) * 10 + lives * 1000`.
- Nuxt stores scores in `data/minigame-scores.txt` as JSONL and keeps only the top 50.

## Served copy

The Nuxt site serves the game from `/public/minigame/`. After changing files in this directory, sync the changed HTML/assets/source files into `/Users/cybrntc/Sites/sabrotto.it/public/minigame/` and keep script cache versions aligned.

## Adding a sprite

1. Add palette keys + grid to `src/sprites.js` inside `SPRITES`.
2. Reference it by key wherever needed in `game.js` or `levels.js`.
3. Verify visually in `sprites.html`.

For higher-detail sprites, keep them as 2D char grids in `src/sprites.js` and draw them with `_drawSpriteHi`; Bit is the current hi-res exception at 52×36 cells.

## Adding a level

1. Append an entry to `LEVELS` in `src/levels.js` — fill `rows`, `theme` (`sunrise`|`sunset`|`moonlight`), `code`, `name`, `timeLimit`, `subtitle`.
2. If it's the final level, place `'P'` (princess) in the grid and omit `'F'` flags.

## No build step

Open `super.html` directly in a browser (or serve from any static host). There is no bundler, transpiler, or package manager involved.

## Self Update

Keep AGENTS.md (this file) up to date following any further changes.
