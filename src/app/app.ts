import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaUpdateService } from './pwa-update.service';
import { PwaInstallService } from './pwa-install.service';
import { ThemeService } from './theme.service';
import { ThemeToggle } from './theme-toggle/theme-toggle';
import { WebMcpService } from './webmcp.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ThemeToggle],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly pwaUpdate = inject(PwaUpdateService);
  private readonly pwaInstall = inject(PwaInstallService);
  private readonly theme = inject(ThemeService);
  private readonly webMcp = inject(WebMcpService);

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    this.pwaUpdate.init();
    this.pwaInstall.init();
    this.webMcp.init();
    this.theme.preference();
  }
}
