import { Component, DestroyRef, inject, afterNextRender, ElementRef, viewChild } from '@angular/core';
import { createGrid, nextGeneration, spawnCluster, Grid } from '../../core/game-of-life.engine';
import { textToPattern } from '../../core/pixel-font.data';

const CELL_SIZE = 6;
const CHAOS_MS = 3000;
const TICK_MS = 150;
const CONVERGE_FRAMES = 25;

@Component({
  selector: 'app-background-canvas',
  templateUrl: './background-canvas.html',
})
export class BackgroundCanvas {
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);

  private grid: Grid = createGrid(1, 1);
  private textMask: Uint8Array = new Uint8Array(0);
  private heroRect: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private phase: 'chaos' | 'converging' | 'settled' = 'chaos';
  private convergeFrame = 0;
  private ctx: CanvasRenderingContext2D | null = null;
  private gw = 0;
  private gh = 0;

  constructor() {
    afterNextRender(() => {
      const canvas = this.canvasRef()?.nativeElement;
      if (!canvas) return;
      this.ctx = canvas.getContext('2d');
      if (!this.ctx) return;

      this.initGrid();
      this.render();

      // RAF-based tick loop
      let lastTick = performance.now();
      let rafId = 0;
      const loop = (now: number) => {
        rafId = requestAnimationFrame(loop);
        if (now - lastTick < TICK_MS) return;
        lastTick = now;
        this.tick();
        this.render();
      };
      rafId = requestAnimationFrame(loop);

      // Transition to convergence after chaos phase
      let convergeTimer = setTimeout(() => this.startConvergence(), CHAOS_MS);

      // Mouse: only active in settled phase, skip hero region
      let lastMouse = 0;
      const mouseMoveHandler = (e: MouseEvent) => {
        if (this.phase !== 'settled') return;
        const now = Date.now();
        if (now - lastMouse < 60) return;
        lastMouse = now;
        const gx = Math.floor(e.clientX / CELL_SIZE);
        const gy = Math.floor(e.clientY / CELL_SIZE);
        if (this.heroRect) {
          const { x0, y0, x1, y1 } = this.heroRect;
          if (gx >= x0 && gx < x1 && gy >= y0 && gy < y1) return;
        }
        spawnCluster(this.grid, gx, gy, 3);
        this.render();
      };
      document.addEventListener('mousemove', mouseMoveHandler);

      // Resize: full reset back to chaos
      const resizeHandler = () => {
        this.phase = 'chaos';
        this.convergeFrame = 0;
        this.heroRect = null;
        this.textMask = new Uint8Array(0);
        this.initGrid();
        this.render();
        clearTimeout(convergeTimer);
        convergeTimer = setTimeout(() => this.startConvergence(), CHAOS_MS);
      };
      window.addEventListener('resize', resizeHandler);

      this.destroyRef.onDestroy(() => {
        cancelAnimationFrame(rafId);
        clearTimeout(convergeTimer);
        document.removeEventListener('mousemove', mouseMoveHandler);
        window.removeEventListener('resize', resizeHandler);
      });
    });
  }

  private initGrid(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    this.gw = Math.ceil(window.innerWidth / CELL_SIZE);
    this.gh = Math.ceil(window.innerHeight / CELL_SIZE);
    this.grid = createGrid(this.gw, this.gh);

    // 20% random fill for chaos phase
    const cells = this.grid.cells;
    for (let i = 0; i < cells.length; i++) {
      cells[i] = Math.random() < 0.20 ? 1 : 0;
    }
  }

  private startConvergence(): void {
    const heroEl = document.querySelector('[data-hero]') as HTMLElement | null;
    if (!heroEl) {
      // Not on home route — skip convergence
      this.phase = 'settled';
      return;
    }

    const rect = heroEl.getBoundingClientRect();
    const x0 = Math.floor(rect.left / CELL_SIZE);
    const y0 = Math.floor(rect.top / CELL_SIZE);
    const x1 = Math.ceil(rect.right / CELL_SIZE);
    const y1 = Math.ceil(rect.bottom / CELL_SIZE);
    this.heroRect = { x0, y0, x1, y1 };

    // Build full-canvas-sized text mask
    this.textMask = new Uint8Array(this.gw * this.gh);
    const pattern = textToPattern('SHUBHAM\nDANGWAL', 2);
    const patH = pattern.length;
    const patW = pattern[0]?.length ?? 0;
    const ox = x0 + Math.floor((x1 - x0 - patW) / 2);
    const oy = y0 + Math.floor((y1 - y0 - patH) / 2) - 2;

    for (let py = 0; py < patH; py++) {
      for (let px = 0; px < patW; px++) {
        if (pattern[py][px]) {
          const gx = ox + px;
          const gy = oy + py;
          if (gx >= 0 && gx < this.gw && gy >= 0 && gy < this.gh) {
            this.textMask[gy * this.gw + gx] = 1;
          }
        }
      }
    }

    this.phase = 'converging';
    this.convergeFrame = 0;
  }

  private tick(): void {
    if (this.phase === 'chaos') {
      this.grid = nextGeneration(this.grid);
      return;
    }

    if (this.phase === 'converging') {
      this.convergeFrame++;
      const t = Math.min(1, this.convergeFrame / CONVERGE_FRAMES);
      const eased = t * t * (3 - 2 * t); // smoothstep

      // Evolve full grid first
      this.grid = nextGeneration(this.grid);
      const cells = this.grid.cells; // re-alias from new Grid object
      const mask = this.textMask;
      const { x0, y0, x1, y1 } = this.heroRect!;

      // Clamp hero region: coax text cells on, kill non-text cells
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * this.gw + x;
          if (mask[i]) {
            if (!cells[i] && Math.random() < eased * 0.5) cells[i] = 1;
          } else {
            if (cells[i] && Math.random() < eased * 0.25) cells[i] = 0;
          }
        }
      }

      // Hard snap on final frame
      if (this.convergeFrame >= CONVERGE_FRAMES) {
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = y * this.gw + x;
            cells[i] = mask[i];
          }
        }
        this.phase = 'settled';
      }
      return;
    }

    if (this.phase === 'settled') {
      this.grid = nextGeneration(this.grid);
      const cells = this.grid.cells; // re-alias from new Grid object
      if (this.heroRect) {
        const mask = this.textMask;
        const { x0, y0, x1, y1 } = this.heroRect;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = y * this.gw + x;
            cells[i] = mask[i]; // text alive, non-text dead
          }
        }
      }
    }
  }

  private render(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;

    const isDark = document.documentElement.classList.contains('dark');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Cells
    const isSettled = this.phase === 'settled';
    const showText = this.phase !== 'chaos';
    const textColor = isDark ? '#e5e5e5' : '#171717';
    const bgColor = isSettled
      ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
      : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)');

    const cells = this.grid.cells;
    const mask = this.textMask;
    const hr = this.heroRect;
    const cs = CELL_SIZE;
    const gw = this.gw;

    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < gw; x++) {
        const i = y * gw + x;
        if (!cells[i]) continue;
        const isText = mask[i] === 1;
        // In settled phase: skip non-text cells inside hero bounds
        if (isSettled && hr && x >= hr.x0 && x < hr.x1 && y >= hr.y0 && y < hr.y1 && !isText) continue;
        ctx.fillStyle = (showText && isText) ? textColor : bgColor;
        ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
      }
    }
  }
}
