import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BackgroundCanvas } from './components/background-canvas/background-canvas';
import { Navbar } from './components/navbar/navbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BackgroundCanvas, Navbar],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
