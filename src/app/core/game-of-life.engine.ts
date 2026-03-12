export interface Grid {
  width: number;
  height: number;
  cells: Uint8Array;
}

export function createGrid(width: number, height: number): Grid {
  return { width, height, cells: new Uint8Array(width * height) };
}

export function getCell(grid: Grid, x: number, y: number): number {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return 0;
  return grid.cells[y * grid.width + x];
}

export function setCell(grid: Grid, x: number, y: number, value: number): void {
  if (x < 0 || x >= grid.width || y < 0 || y >= grid.height) return;
  grid.cells[y * grid.width + x] = value;
}

export function nextGeneration(grid: Grid): Grid {
  const next = createGrid(grid.width, grid.height);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          neighbors += getCell(grid, x + dx, y + dy);
        }
      }
      const alive = getCell(grid, x, y);
      if (alive) {
        next.cells[y * grid.width + x] = neighbors === 2 || neighbors === 3 ? 1 : 0;
      } else {
        next.cells[y * grid.width + x] = neighbors === 3 ? 1 : 0;
      }
    }
  }
  return next;
}

export function stampPattern(grid: Grid, pattern: boolean[][], offsetX: number, offsetY: number): void {
  for (let y = 0; y < pattern.length; y++) {
    for (let x = 0; x < pattern[y].length; x++) {
      if (pattern[y][x]) {
        setCell(grid, offsetX + x, offsetY + y, 1);
      }
    }
  }
}

export function spawnCluster(grid: Grid, cx: number, cy: number, radius: number): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy <= radius * radius && Math.random() < 0.4) {
        setCell(grid, cx + dx, cy + dy, 1);
      }
    }
  }
}
