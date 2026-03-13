import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GolPhaseService {
  readonly settled = signal(false);
}
