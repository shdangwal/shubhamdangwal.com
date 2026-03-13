import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BackgroundCanvas } from './components/background-canvas/background-canvas';
import { Navbar } from './components/navbar/navbar';
import { GolPhaseService } from './core/gol-phase.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BackgroundCanvas, Navbar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly settled = inject(GolPhaseService).settled;
}
