import { Injectable, signal } from '@angular/core';

export interface StampRequest {
  pattern: boolean[][];
  pixelX: number;
  pixelY: number;
}

@Injectable({ providedIn: 'root' })
export class GolInteractionService {
  readonly stampRequest = signal<StampRequest | null>(null);
  readonly disruptRequest = signal(0);
  readonly disruptionActive = signal(false);
}
