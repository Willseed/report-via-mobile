import { DestroyRef, inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter, take } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ZH_TW } from './i18n';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly swUpdate = inject(SwUpdate);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const snackBarRef = this.snackBar.open(ZH_TW.pwa.updateAvailable, ZH_TW.pwa.updateAction, {
          duration: 0,
        });
        snackBarRef.onAction().pipe(take(1)).subscribe(() => {
          this.activateUpdate();
        });
      });

    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.snackBar.open(ZH_TW.pwa.unrecoverableError, '', { duration: 3000 });
        setTimeout(() => { location.reload(); }, 3000);
      });
  }

  private activateUpdate(): void {
    this.swUpdate
      .activateUpdate()
      .then(() => {
        location.reload();
      })
      .catch(() => this.snackBar.open(ZH_TW.pwa.updateFailed, '', { duration: 5000 }));
  }
}
