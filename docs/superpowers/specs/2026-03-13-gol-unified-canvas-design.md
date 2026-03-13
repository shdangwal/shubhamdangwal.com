# GoL Unified Canvas Design

**Date:** 2026-03-13
**Status:** Approved (post-review revision)

## Problem

The site has two independent GoL simulations:
- `BackgroundCanvas`: `cellSize=20`, starts empty, mouse-activated only
- `Hero`: `cellSize=4`, own canvas, chaos→convergence independently

This causes visual disconnection (different cell sizes, no unified animation) and the hero canvas has been unreliable at rendering text.

## Solution

Single simulation owned by `BackgroundCanvas` at `cellSize=6`. Hero becomes a pure CSS shell.

## Cell Size

`CELL_SIZE = 6` (constant, exported from `background-canvas.ts`)

- Full page 1920×1080: ~320×180 = 57,600 cells — fast for rAF
- "SHUBHAM" at font scale 2: ~500px wide on a 1400px screen — readable
- Unified across hero text and background

## Canonical Timing Constants

```
CELL_SIZE       = 6       px
CHAOS_MS        = 3000    ms  (chaos phase duration)
TICK_MS         = 150     ms  (simulation tick interval)
CONVERGE_FRAMES = 25      ticks  (25 × 150ms = 3.75s convergence)
```

Total time to settled: **~6.75s** (3s chaos + 3.75s converge). This is intentionally slightly over the "3-5s" feel target — the text becomes fully legible mid-convergence, not only at the hard snap.

## Phase Flow

```
[chaos]      0ms – 3000ms       GoL on full page, 20% random fill, 150ms/tick
[converging] 3000ms – 6750ms    Text cells force-on, non-text hero cells killed; 25 ticks
[settled]    6750ms+             Text locked; GoL continues outside hero; mouse active
```

## BackgroundCanvas

### State

```typescript
private grid: Grid
private textMask: Uint8Array          // full-canvas-sized (gw × gh), 1 where text cell
private heroRect: { x0: number; y0: number; x1: number; y1: number } | null = null
private phase: 'chaos' | 'converging' | 'settled' = 'chaos'
private convergeFrame = 0
```

`textMask` is **full-canvas-sized** (`gw * gh` entries). Text cell at grid position `(gx, gy)` sets `textMask[gy * gw + gx] = 1`. No sub-rect offset arithmetic needed at render/tick time.

### initGrid()

1. `canvas.width = window.innerWidth; canvas.height = window.innerHeight`
2. `gw = ceil(W / CELL_SIZE); gh = ceil(H / CELL_SIZE)`
3. `grid = createGrid(gw, gh)`
4. Random fill: `cells[i] = Math.random() < 0.20 ? 1 : 0` for all `i`

### startConvergence() — called once after CHAOS_MS

```
heroEl = document.querySelector('[data-hero]')
if (!heroEl) { phase = 'settled'; return }   // non-home route fallback

rect = heroEl.getBoundingClientRect()
x0 = floor(rect.left / CELL_SIZE)
y0 = floor(rect.top  / CELL_SIZE)
x1 = ceil(rect.right  / CELL_SIZE)
y1 = ceil(rect.bottom / CELL_SIZE)
heroRect = { x0, y0, x1, y1 }

textMask = new Uint8Array(gw * gh)    // full canvas size
pattern  = textToPattern('SHUBHAM\nDANGWAL', scale=2)
patH = pattern.length
patW = pattern[0].length
ox = x0 + floor((x1 - x0 - patW) / 2)
oy = y0 + floor((y1 - y0 - patH) / 2) - 2

for py in 0..patH-1:
  for px in 0..patW-1:
    if pattern[py][px]:
      gx = ox + px; gy = oy + py
      if 0 <= gx < gw AND 0 <= gy < gh:
        textMask[gy * gw + gx] = 1

phase = 'converging'
convergeFrame = 0
```

### tick() — converging

Background cells **continue to evolve** during convergence. `nextGeneration` is called on the full grid first, then the hero region is clamped. This prevents a visible 3.75s freeze of the background.

Smoothstep easing: `eased = t² × (3 − 2t)` where `t = convergeFrame / CONVERGE_FRAMES`.

```
convergeFrame++
t = min(1, convergeFrame / CONVERGE_FRAMES)
eased = t*t * (3 - 2*t)

grid = nextGeneration(grid)
cells = grid.cells   // re-alias from the new Grid object

for y in heroRect.y0..heroRect.y1-1:
  for x in heroRect.x0..heroRect.x1-1:
    i = y * gw + x
    if textMask[i]:
      if !cells[i] && random() < eased * 0.5:  cells[i] = 1
    else:
      if cells[i]  && random() < eased * 0.25: cells[i] = 0

if convergeFrame >= CONVERGE_FRAMES:
  // hard snap hero region
  for y in heroRect.y0..heroRect.y1-1:
    for x in heroRect.x0..heroRect.x1-1:
      i = y * gw + x
      cells[i] = textMask[i]
  phase = 'settled'
```

### tick() — settled

```
grid = nextGeneration(grid)
cells = grid.cells   // re-alias from the new Grid object — do not use stale reference
if heroRect:
  for y in heroRect.y0..heroRect.y1-1:
    for x in heroRect.x0..heroRect.x1-1:
      i = y * gw + x
      cells[i] = textMask[i]   // text alive, non-text dead
```

### Resize Handling

On `window.resize`:
1. Reset `phase = 'chaos'`, `convergeFrame = 0`
2. Clear `heroRect = null`, `textMask = new Uint8Array(0)`
3. Re-run `initGrid()` (new random fill)
4. Cancel and restart the `CHAOS_MS` timeout for `startConvergence()`

### Mouse

- Active only when `phase === 'settled'`
- Throttled to 60ms
- Spawn radius: `3` cells (slightly larger than current 2 to compensate for smaller cell size)
- Guard: skip if `(gx, gy)` is inside `heroRect` bounds

### Render

Colors (intentionally changed from current implementation):

| Context | Light | Dark |
|---|---|---|
| Background alive cells (chaos) | `rgba(0,0,0,0.07)` | `rgba(255,255,255,0.07)` |
| Background alive cells (settled) | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.05)` |
| Grid lines | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.03)` |
| Text cells (converging+settled) | `#171717` | `#e5e5e5` |

Render loop: single pass over `grid.cells`. In settled phase, skip non-text cells inside `heroRect`.

## Hero Component

**Remove:**
- `<canvas #heroCanvas>` element
- All TypeScript: `viewChild`, `DestroyRef`, grid, textMask, phase, tick(), render(), initHero()
- Import of `game-of-life.engine` and `pixel-font.data`

**Keep:**
- `<section class="relative w-full h-full border border-neutral-300 dark:border-neutral-700 overflow-hidden" data-hero>`
- Subtitle overlay `div` with `z-10`
- `hero.css` unchanged (`display: block; height: 100%`)

`hero.ts` becomes a no-op component:
```typescript
@Component({ selector: 'app-hero', templateUrl: './hero.html', styleUrl: './hero.css' })
export class Hero {}
```

## Files Changed

| File | Change |
|---|---|
| `background-canvas.ts` | Full rewrite |
| `hero.ts` | Strip to empty component class |
| `hero.html` | Remove `<canvas>`, add `data-hero` |

## Files Unchanged

`game-of-life.engine.ts`, `pixel-font.data.ts`, `app.html`, `app.ts`, `app.routes.ts`, `styles.css`, `navbar.ts/html`, `hero.css`
