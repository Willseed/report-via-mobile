import { DestroyRef, inject, Injectable } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private swUpdate = inject(SwUpdate);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  init(): void {
    if (!this.swUpdate.isEnabled) return;

    this.swUpdate.versionUpdates
      .pipe(
        filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        const snackBarRef = this.snackBar.open('有新版本可用', '更新', {
          duration: 0,
        });
        snackBarRef.onAction().subscribe(() => {
          void this.swUpdate
            .activateUpdate()
            .then(() => { location.reload(); })
            .catch(() => this.snackBar.open('更新失敗，請重新整理頁面', '', { duration: 5000 }));
        });
      });

    this.swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.snackBar.open('應用程式發生錯誤，將重新載入', '', { duration: 3000 });
        setTimeout(() => { location.reload(); }, 3000);
      });
  }
}
