import { Component, DestroyRef, inject, afterNextRender, ElementRef, viewChild } from '@angular/core';
import { createGrid, nextGeneration, spawnCluster, stampPattern, Grid } from '../../core/game-of-life.engine';
import { textToPattern } from '../../core/pixel-font.data';
import { GolPhaseService } from '../../core/gol-phase.service';
import { GolInteractionService } from '../../core/gol-interaction.service';

const CELL_SIZE = 6;
const CHAOS_MS = 3000;
const TICK_MS = 150;
const CONVERGE_FRAMES = 25;
const TEXT_FADE_SPEED = 0.010; // ~1.7s at 60fps
const PULSE_PERIOD_TICKS = 4;  // ~600ms blink period
const DISRUPT_DURATION_MS = 4000;

@Component({
  selector: 'app-background-canvas',
  templateUrl: './background-canvas.html',
})
export class BackgroundCanvas {
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);
  private readonly golPhase = inject(GolPhaseService);
  private readonly golInteraction = inject(GolInteractionService);

  private grid: Grid = createGrid(1, 1);
  private textMask: Uint8Array = new Uint8Array(0);
  private pulseMask: Uint8Array = new Uint8Array(0);
  private heroRect: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private phase: 'chaos' | 'converging' | 'settled' = 'chaos';
  private namePhase: 'resting' | 'disrupted' = 'resting';
  private convergeFrame = 0;
  private textFade = 0;
  private pulseTick = 0;
  private disruptSeenRequest = 0;
  private disruptEndTime = 0;
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

      // RAF loop: tick simulation at TICK_MS, render every frame during fade/disruption
      let lastTick = performance.now();
      let rafId = 0;
      const loop = (now: number) => {
        rafId = requestAnimationFrame(loop);
        let needsRender = false;

        // Consume stamp request
        const req = this.golInteraction.stampRequest();
        if (req && this.phase === 'settled') {
          const cx = Math.floor(req.pixelX / CELL_SIZE);
          const cy = Math.floor(req.pixelY / CELL_SIZE);
          const patH = req.pattern.length;
          const patW = req.pattern[0]?.length ?? 0;
          // Clamp to grid bounds; hero enforcement in tick() handles any overlap naturally
          const ox = Math.max(0, Math.min(this.gw - patW, cx - Math.floor(patW / 2)));
          const oy = Math.max(0, Math.min(this.gh - patH, cy - Math.floor(patH / 2)));
          stampPattern(this.grid, req.pattern, ox, oy);
          this.golInteraction.stampRequest.set(null);
          needsRender = true;
        }

        // Consume disrupt request
        const disruptCount = this.golInteraction.disruptRequest();
        if (
          disruptCount !== this.disruptSeenRequest &&
          this.phase === 'settled' &&
          this.namePhase === 'resting'
        ) {
          this.disruptSeenRequest = disruptCount;
          this.namePhase = 'disrupted';
          this.disruptEndTime = now + DISRUPT_DURATION_MS;
          this.golInteraction.disruptionActive.set(true);
          needsRender = true;
        }

        // End disruption — next tick() will hard-snap hero region via resting enforcement
        if (this.namePhase === 'disrupted' && now >= this.disruptEndTime) {
          this.namePhase = 'resting';
          this.pulseTick = 0;
          this.golInteraction.disruptionActive.set(false);
          needsRender = true;
        }

        // Simulation tick
        if (now - lastTick >= TICK_MS) {
          lastTick = now;
          this.tick();
          needsRender = true;
        }

        // Text fade (runs every RAF frame while in progress)
        if (this.phase === 'settled' && this.textFade < 1) {
          this.textFade = Math.min(1, this.textFade + TEXT_FADE_SPEED);
          needsRender = true;
        }

        if (needsRender) this.render();
      };
      rafId = requestAnimationFrame(loop);

      // Start convergence after chaos phase
      let convergeTimer = setTimeout(() => this.startConvergence(), CHAOS_MS);

      // Mouse: settled phase only, skip hero region
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

      // Resize: full reset to chaos
      const resizeHandler = () => {
        this.phase = 'chaos';
        this.namePhase = 'resting';
        this.convergeFrame = 0;
        this.textFade = 0;
        this.pulseTick = 0;
        this.heroRect = null;
        this.textMask = new Uint8Array(0);
        this.pulseMask = new Uint8Array(0);
        this.golInteraction.disruptionActive.set(false);
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
      this.phase = 'settled';
      this.golPhase.settled.set(true);
      return;
    }

    const rect = heroEl.getBoundingClientRect();
    const x0 = Math.floor(rect.left / CELL_SIZE);
    const y0 = Math.floor(rect.top / CELL_SIZE);
    const x1 = Math.ceil(rect.right / CELL_SIZE);
    const y1 = Math.ceil(rect.bottom / CELL_SIZE);
    this.heroRect = { x0, y0, x1, y1 };

    // Build textMask
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

    // Build pulseMask: topmost text cell every ~12 grid columns (≈ one blinker per glyph)
    this.pulseMask = new Uint8Array(this.gw * this.gh);
    for (let x = x0; x < x1; x += 12) {
      for (let y = y0; y < y1; y++) {
        const i = y * this.gw + x;
        if (this.textMask[i]) {
          this.pulseMask[i] = 1;
          break;
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
      const eased = t * t * (3 - 2 * t);

      this.grid = nextGeneration(this.grid);
      const cells = this.grid.cells;
      const mask = this.textMask;
      const { x0, y0, x1, y1 } = this.heroRect!;

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

      if (this.convergeFrame >= CONVERGE_FRAMES) {
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = y * this.gw + x;
            cells[i] = mask[i];
          }
        }
        this.phase = 'settled';
        this.golPhase.settled.set(true);
      }
      return;
    }

    if (this.phase === 'settled') {
      this.grid = nextGeneration(this.grid);
      const cells = this.grid.cells;

      if (this.namePhase === 'resting' && this.heroRect) {
        const mask = this.textMask;
        const pulse = this.pulseMask;
        const { x0, y0, x1, y1 } = this.heroRect;
        this.pulseTick++;
        const pulseOn = Math.floor(this.pulseTick / PULSE_PERIOD_TICKS) % 2 === 0;

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const i = y * this.gw + x;
            // Pulse cells blink; all other text cells held static
            cells[i] = pulse[i] ? (pulseOn ? 1 : 0) : mask[i];
          }
        }
      }
      // namePhase === 'disrupted': no hero enforcement — pure GoL runs freely
    }
  }

  /** Interpolates from bg-cell color (fade=0) to full text color (fade=1). */
  private lerpTextColor(isDark: boolean, fade: number): string {
    if (fade <= 0) return isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    if (fade >= 1) return isDark ? '#e5e5e5' : '#171717';
    if (isDark) {
      const v = Math.round(255 - 26 * fade);
      const a = (0.15 + 0.85 * fade).toFixed(3);
      return `rgba(${v},${v},${v},${a})`;
    } else {
      const v = Math.round(23 * fade);
      const a = (0.15 + 0.85 * fade).toFixed(3);
      return `rgba(${v},${v},${v},${a})`;
    }
  }

  private render(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;

    const isDark = document.documentElement.classList.contains('dark');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvas.width; x += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += CELL_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // Cells
    const isSettled = this.phase === 'settled';
    const isDisrupted = this.namePhase === 'disrupted';
    const bgColor = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
    const textCellColor = this.lerpTextColor(isDark, this.textFade);

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
        // In settled + resting: skip non-text cells inside hero bounds
        if (isSettled && !isDisrupted && hr && x >= hr.x0 && x < hr.x1 && y >= hr.y0 && y < hr.y1 && !isText) continue;
        // Text color only when resting — disruption strips the visual distinction
        ctx.fillStyle = (isSettled && !isDisrupted && isText) ? textCellColor : bgColor;
        ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
      }
    }
  }
}
