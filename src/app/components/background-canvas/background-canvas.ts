import { Component, DestroyRef, inject, afterNextRender, ElementRef, viewChild } from '@angular/core';
import { createGrid, nextGeneration, spawnCluster, Grid } from '../../core/game-of-life.engine';

@Component({
  selector: 'app-background-canvas',
  templateUrl: './background-canvas.html',
})
export class BackgroundCanvas {
  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);
  private grid: Grid = createGrid(1, 1);
  private readonly cellSize = 20;
  private ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    afterNextRender(() => {
      const canvas = this.canvasRef()?.nativeElement;
      if (!canvas) return;
      this.ctx = canvas.getContext('2d');

      this.initGrid();
      this.render();

      const resizeHandler = () => {
        this.initGrid();
        this.render();
      };
      window.addEventListener('resize', resizeHandler);

      let lastMouse = 0;
      const mouseMoveHandler = (e: MouseEvent) => {
        const now = Date.now();
        if (now - lastMouse < 60) return;
        lastMouse = now;
        const gx = Math.floor(e.clientX / this.cellSize);
        const gy = Math.floor(e.clientY / this.cellSize);
        spawnCluster(this.grid, gx, gy, 2);
        this.render();
      };
      document.addEventListener('mousemove', mouseMoveHandler);

      const interval = setInterval(() => {
        this.grid = nextGeneration(this.grid);
        this.render();
      }, 250);

      this.destroyRef.onDestroy(() => {
        clearInterval(interval);
        window.removeEventListener('resize', resizeHandler);
        document.removeEventListener('mousemove', mouseMoveHandler);
      });
    });
  }

  private initGrid(): void {
    const w = Math.ceil(window.innerWidth / this.cellSize);
    const h = Math.ceil(window.innerHeight / this.cellSize);
    this.grid = createGrid(w, h);

    const canvas = this.canvasRef()?.nativeElement;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }

  private render(): void {
    const canvas = this.canvasRef()?.nativeElement;
    const ctx = this.ctx;
    if (!canvas || !ctx) return;
    const isDark = document.documentElement.classList.contains('dark');

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= canvas.width; x += this.cellSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += this.cellSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Alive cells
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)';
    const grid = this.grid;
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        if (grid.cells[y * grid.width + x]) {
          ctx.fillRect(x * this.cellSize + 1, y * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2);
        }
      }
    }
  }
}
