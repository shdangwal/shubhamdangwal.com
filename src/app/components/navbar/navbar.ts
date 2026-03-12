import { Component, signal, afterNextRender } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
})
export class Navbar {
  protected isDark = signal(false);

  constructor() {
    afterNextRender(() => {
      this.isDark.set(document.documentElement.classList.contains('dark'));
    });
  }

  protected toggleDarkMode(): void {
    const dark = !this.isDark();
    this.isDark.set(dark);
    document.documentElement.classList.toggle('dark', dark);
  }
}
