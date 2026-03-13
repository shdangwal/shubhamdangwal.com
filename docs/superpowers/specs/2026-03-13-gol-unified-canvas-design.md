# GoL Unified Canvas Design

**Date:** 2026-03-13
**Status:** Approved

## Problem

The site currently has two independent GoL simulations:
- `BackgroundCanvas`: `cellSize=20`, starts empty, mouse-activated only
- `Hero`: `cellSize=4`, has its own canvas, runs chaos→convergence independently

This causes visual disconnection (different cell sizes, no unified animation), and the hero canvas has been unreliable at rendering the name text.

## Solution

Consolidate to a single simulation owned by `BackgroundCanvas`. Hero becomes a pure CSS shell.

## Cell Size

`cellSize = 6px`

- Full page at 1920×1080: ~320×180 = 57,600 cells — fast enough for rAF
- "SHUBHAM" at font scale 2: ~500px wide on a 1400px screen — readable
- Unified across hero text and background cells

## Phase Flow

```
[chaos]      0 – 3s    Full page ~20% random fill, GoL evolves at 150ms/tick
[converging] 3 – 4.5s  Text cells force-on in hero region, non-text hero cells killed
[settled]    4.5s+      Text locked, GoL continues outside hero, mouse spawns cells
```

## BackgroundCanvas

### initGrid()
- Sets canvas to `window.innerWidth × window.innerHeight`
- Creates grid `ceil(W/6) × ceil(H/6)`
- Fills cells at 20% random density

### startConvergence() — called at 3s
- Queries `document.querySelector('[data-hero]')` for bounding rect
- Converts rect to grid coordinates `{x0, y0, x1, y1}`
- Builds `textMask: Uint8Array` by calling `textToPattern('SHUBHAM\nDANGWAL', 2)` centered within hero bounds
- Sets `phase = 'converging'`

### tick() — converging (40 frames × 150ms = 6s convergence window)
- `progress = frame / 40`, eased with smoothstep
- Hero region: text cells turned on with probability `eased * 0.5`, non-text cells killed with `eased * 0.25`
- At frame 40: hard snap — hero region clamped to `cells[i] = textMask[i]`
- Sets `phase = 'settled'`

### tick() — settled
- `nextGeneration()` on full grid
- Hero region re-clamped every tick: text cells forced alive, non-text cells killed

### Mouse
- Active only during `settled` phase
- Spawns clusters only **outside** hero bounds
- Throttled to 60ms

### Render colors
| Context | Light | Dark |
|---|---|---|
| Background alive cells | `rgba(0,0,0,0.05)` | `rgba(255,255,255,0.05)` |
| Grid lines | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.03)` |
| Text cells (hero) | `#171717` | `#e5e5e5` |

## Hero Component

- **Remove**: canvas element, all simulation TypeScript, `viewChild` refs, `DestroyRef`, animation logic
- **Keep**: `<section data-hero class="relative w-full h-full border ...">` + subtitle/button overlay
- CSS: `display: block; height: 100%` unchanged

## Files Changed

| File | Change |
|---|---|
| `background-canvas.ts` | Full rewrite — unified cellSize, phases, text convergence |
| `hero.ts` | Strip to empty component |
| `hero.html` | Remove `<canvas>`, add `data-hero` to section |
| `hero.css` | No change |

## Files Unchanged

- `game-of-life.engine.ts`
- `pixel-font.data.ts`
- `app.html`, `app.ts`, `app.routes.ts`
- `styles.css`
- `navbar.ts/html`
