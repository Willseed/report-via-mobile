import {
  Component,
  DestroyRef,
  EnvironmentInjector,
  inject,
  runInInjectionContext,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PwaUpdateService } from './pwa-update.service';
import { PwaInstallService } from './pwa-install.service';
import { ThemeService } from './theme.service';
import { ThemeToggle } from './theme-toggle/theme-toggle';

interface IdleDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

interface IdleRequestOptions {
  readonly timeout?: number;
}

type IdleRequestCallback = (deadline: IdleDeadline) => void;

interface WindowWithIdleCallback {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
}

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
  private readonly injector = inject(EnvironmentInjector);
  private readonly destroyRef = inject(DestroyRef);
  private webMcpInitCancelled = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.webMcpInitCancelled = true;
    });
    this.initializeApp();
  }

  private initializeApp(): void {
    this.pwaUpdate.init();
    this.pwaInstall.init();
    this.scheduleWebMcpInit();
    this.theme.preference();
  }

  private scheduleWebMcpInit(): void {
    const windowWithIdleCallback = globalThis as typeof globalThis & WindowWithIdleCallback;

    if (typeof windowWithIdleCallback.requestIdleCallback === 'function') {
      windowWithIdleCallback.requestIdleCallback(() => {
        void this.initWebMcp();
      }, { timeout: 2000 });
      return;
    }

    setTimeout(() => {
      void this.initWebMcp();
    }, 0);
  }

  private async initWebMcp(): Promise<void> {
    try {
      const { WebMcpService } = await import('./webmcp.service');

      if (this.webMcpInitCancelled) {
        return;
      }

      runInInjectionContext(this.injector, () => {
        inject(WebMcpService).init();
      });
    } catch (error: unknown) {
      if (!this.webMcpInitCancelled) {
        console.error('無法初始化 WebMCP 整合。', error);
      }
    }
  }
}
