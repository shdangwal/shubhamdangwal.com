import { Component, signal, inject, afterNextRender, ElementRef, DestroyRef } from '@angular/core';
import { GolPhaseService } from '../../core/gol-phase.service';
import { GolInteractionService } from '../../core/gol-interaction.service';
import { GOL_PATTERNS, GolPattern } from '../../core/gol-patterns.data';

@Component({
  selector: 'app-hero',
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero {
  private readonly golPhase = inject(GolPhaseService);
  private readonly golInteraction = inject(GolInteractionService);
  private readonly el = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly settled = this.golPhase.settled;
  protected readonly disruptionActive = this.golInteraction.disruptionActive;
  protected readonly menuOpen = signal(false);
  protected readonly menuView = signal<'patterns' | 'explainer'>('patterns');
  protected readonly patterns: GolPattern[] = GOL_PATTERNS;

  constructor() {
    afterNextRender(() => {
      const onClick = (e: MouseEvent) => {
        if (this.menuOpen() && !this.el.nativeElement.contains(e.target)) {
          this.menuOpen.set(false);
          this.menuView.set('patterns');
        }
      };
      const onKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && this.menuOpen()) {
          this.menuOpen.set(false);
          this.menuView.set('patterns');
        }
      };
      document.addEventListener('click', onClick);
      document.addEventListener('keydown', onKeydown);
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('click', onClick);
        document.removeEventListener('keydown', onKeydown);
      });
    });
  }

  protected toggleMenu(): void {
    if (!this.settled()) return;
    this.menuOpen.update(v => !v);
    if (!this.menuOpen()) this.menuView.set('patterns');
  }

  protected stampPattern(cells: boolean[][]): void {
    this.golInteraction.stampRequest.set({
      pattern: cells,
      pixelX: window.innerWidth / 2,
      pixelY: window.innerHeight / 2,
    });
    this.menuOpen.set(false);
    this.menuView.set('patterns');
  }

  protected showExplainer(): void {
    this.menuView.set('explainer');
  }

  protected backToPatterns(): void {
    this.menuView.set('patterns');
  }

  protected disrupt(): void {
    if (!this.settled() || this.disruptionActive()) return;
    this.golInteraction.disruptRequest.update(n => n + 1);
  }
}
