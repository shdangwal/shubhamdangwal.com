import { Component, DestroyRef, inject, afterNextRender, ElementRef, viewChild } from '@angular/core';
import { createGrid, nextGeneration, Grid } from '../../core/game-of-life.engine';
import { textToPattern } from '../../core/pixel-font.data';

@Component({
  selector: 'app-hero',
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('heroCanvas');
  private readonly containerRef = viewChild<ElementRef<HTMLElement>>('heroContainer');
  private readonly destroyRef = inject(DestroyRef);
  private grid: Grid = createGrid(1, 1);
  private readonly cellSize = 4;
  private textMask: Uint8Array = new Uint8Array(0);
  private ctx: CanvasRenderingContext2D | null = null;
  private gw = 0;
  private gh = 0;

  // Animation state
  private phase: 'chaos' | 'converging' | 'settled' = 'chaos';
  private convergeFrame = 0;
  private readonly CONVERGE_FRAMES = 40;

  constructor() {
    afterNextRender(() => {
      const canvas = this.canvasRef()?.nativeElement;
      if (!canvas) return;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) return;

      this.initHero();
      this.render();

      // Start animation loop
      let rafId = 0;
      let lastTick = performance.now();
      const TICK_MS = 120;

      const loop = (now: number) => {
        rafId = requestAnimationFrame(loop);
        if (now - lastTick < TICK_MS) return;
        lastTick = now;
        this.tick();
        this.render();
      };
      rafId = requestAnimationFrame(loop);

      // After 3s, start convergence
      let convergeTimer = setTimeout(() => {
        this.phase = 'converging';
        this.convergeFrame = 0;
      }, 3000);

      const resizeHandler = () => {
        this.phase = 'chaos';
        this.convergeFrame = 0;
        this.initHero();
        this.render();
        clearTimeout(convergeTimer);
        convergeTimer = setTimeout(() => {
          this.phase = 'converging';
          this.convergeFrame = 0;
        }, 3000);
      };
      window.addEventListener('resize', resizeHandler);

      this.destroyRef.onDestroy(() => {
        cancelAnimationFrame(rafId);
        clearTimeout(convergeTimer);
        window.removeEventListener('resize', resizeHandler);
      });
    });
  }

  private tick(): void {
    if (this.phase === 'chaos') {
      this.grid = nextGeneration(this.grid);
      return;
    }

    if (this.phase === 'settled') return;

    // Converging
    this.convergeFrame++;
    const progress = this.convergeFrame / this.CONVERGE_FRAMES;

    // Each frame: turn on some text cells, turn off some non-text cells
    const cells = this.grid.cells;
    const mask = this.textMask;
    const len = cells.length;

    for (let i = 0; i < len; i++) {
      if (mask[i]) {
        // Text cell: turn on with increasing probability
        if (!cells[i] && Math.random() < progress * 0.5) {
          cells[i] = 1;
        }
      } else {
        // Non-text cell: turn off with increasing probability
        if (cells[i] && Math.random() < progress * 0.2) {
          cells[i] = 0;
        }
      }
    }

    if (this.convergeFrame >= this.CONVERGE_FRAMES) {
      // Hard snap to final state
      for (let i = 0; i < len; i++) {
        cells[i] = mask[i];
      }
      this.phase = 'settled';
    }
  }

  private initHero(): void {
    const container = this.containerRef()?.nativeElement;
    const canvas = this.canvasRef()?.nativeElement;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    canvas.width = rect.width;
    canvas.height = rect.height;

    this.gw = Math.ceil(rect.width / this.cellSize);
    this.gh = Math.ceil(rect.height / this.cellSize);

    const totalCells = this.gw * this.gh;
    this.grid = createGrid(this.gw, this.gh);
    this.textMask = new Uint8Array(totalCells);

    const pattern = textToPattern('SHUBHAM\nDANGWAL', 2);
    const patH = pattern.length;
    const patW = pattern[0]?.length ?? 0;
    const ox = Math.floor((this.gw - patW) / 2);
    const oy = Math.floor((this.gh - patH) / 2) - 4;

    // Record text mask
    let textCellCount = 0;
    for (let y = 0; y < patH; y++) {
      for (let x = 0; x < patW; x++) {
        if (pattern[y][x]) {
          const gx = ox + x;
          const gy = oy + y;
          if (gx >= 0 && gx < this.gw && gy >= 0 && gy < this.gh) {
            this.textMask[gy * this.gw + gx] = 1;
            textCellCount++;
          }
        }
      }
    }

    // Fill with random cells for chaos phase
    const cells = this.grid.cells;
    for (let i = 0; i < totalCells; i++) {
      if (Math.random() < 0.15) {
        cells[i] = 1;
      }
    }
  }

  private render(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;

    const isDark = document.documentElement.classList.contains('dark');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const textColor = isDark ? '#e5e5e5' : '#171717';
    const cellColor = isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)';
    const isSettled = this.phase === 'settled';
    const showTextColor = this.phase !== 'chaos';
    const cells = this.grid.cells;
    const mask = this.textMask;
    const cs = this.cellSize;
    const w = this.grid.width;

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (!cells[idx]) continue;
        if (isSettled && !mask[idx]) continue;
        ctx.fillStyle = (showTextColor && mask[idx]) ? textColor : cellColor;
        ctx.fillRect(x * cs, y * cs, cs - 1, cs - 1);
      }
    }
  }
}
