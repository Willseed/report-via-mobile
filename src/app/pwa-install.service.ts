import { DestroyRef, inject, Injectable, NgZone, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent } from 'rxjs';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private snackBar = inject(MatSnackBar);
  private ngZone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  private deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
  readonly canInstall = this.deferredPrompt.asReadonly();

  init(): void {
    this.ngZone.runOutsideAngular(() => {
      fromEvent<BeforeInstallPromptEvent>(window, 'beforeinstallprompt')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((event) => {
          event.preventDefault();
          this.ngZone.run(() => {
            this.deferredPrompt.set(event);
            const snackBarRef = this.snackBar.open('可將此應用安裝至主畫面', '安裝', {
              duration: 8000,
            });
            snackBarRef.onAction().subscribe(() => void this.promptInstall());
          });
        });
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
