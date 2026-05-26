import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, take } from 'rxjs';
import { ZH_TW } from './i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  private deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
  readonly canInstall = this.deferredPrompt.asReadonly();

  init(): void {
    fromEvent<BeforeInstallPromptEvent>(globalThis, 'beforeinstallprompt')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        event.preventDefault();
        this.deferredPrompt.set(event);
        const snackBarRef = this.snackBar.open(ZH_TW.pwa.installPrompt, ZH_TW.pwa.installAction, {
          duration: 8000,
        });
        snackBarRef.onAction().pipe(take(1)).subscribe(() => void this.promptInstall());
      });
  }

  async promptInstall(): Promise<void> {
    const prompt = this.deferredPrompt();
    if (!prompt) return;

    try {
      await prompt.prompt();
    } catch {
      // Browser rejected the install prompt
    }
    this.deferredPrompt.set(null);
  }
}
