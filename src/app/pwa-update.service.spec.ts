import { TestBed } from '@angular/core/testing';
import { SwUpdate, UnrecoverableStateEvent, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { describe, it, expect, vi } from 'vitest';
import { Subject } from 'rxjs';
import { PwaUpdateService } from './pwa-update.service';

interface PwaUpdateTestContext {
  service: PwaUpdateService;
  versionUpdates$: Subject<VersionReadyEvent>;
  unrecoverable$: Subject<UnrecoverableStateEvent>;
  snackBarSpy: { open: ReturnType<typeof vi.fn> };
  snackBarAction$: Subject<void>;
  activateUpdateSpy: ReturnType<typeof vi.fn>;
}

function setupPwaUpdateService(
  options: { isEnabled?: boolean; activateUpdate?: ReturnType<typeof vi.fn> } = {},
): PwaUpdateTestContext {
  const { isEnabled = true, activateUpdate } = options;
  const versionUpdates$ = new Subject<VersionReadyEvent>();
  const unrecoverable$ = new Subject<UnrecoverableStateEvent>();
  const snackBarAction$ = new Subject<void>();
  const activateUpdateSpy = activateUpdate ?? vi.fn().mockResolvedValue(undefined);
  const snackBarSpy = {
    open: vi.fn().mockReturnValue({
      onAction: () => snackBarAction$,
    } as unknown as MatSnackBarRef<TextOnlySnackBar>),
  };

  TestBed.configureTestingModule({
    providers: [
      {
        provide: SwUpdate,
        useValue: {
          isEnabled,
          versionUpdates: versionUpdates$,
          unrecoverable: unrecoverable$,
          activateUpdate: activateUpdateSpy,
        },
      },
      { provide: MatSnackBar, useValue: snackBarSpy },
    ],
  });

  return {
    service: TestBed.inject(PwaUpdateService),
    versionUpdates$,
    unrecoverable$,
    snackBarSpy,
    snackBarAction$,
    activateUpdateSpy,
  };
}

describe('PwaUpdateService', () => {
  it('should be created', () => {
    const { service } = setupPwaUpdateService();
    expect(service).toBeTruthy();
  });

  it('should show snackbar when VERSION_READY event fires', () => {
    const { service, versionUpdates$, snackBarSpy } = setupPwaUpdateService();
    service.init();

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc' },
      latestVersion: { hash: 'def' },
    });

    expect(snackBarSpy.open).toHaveBeenCalledWith('有新版本可用', '更新', { duration: 0 });
  });

  it('should not show snackbar for non-VERSION_READY events', () => {
    const { service, versionUpdates$, snackBarSpy } = setupPwaUpdateService();
    service.init();

    versionUpdates$.next({ type: 'VERSION_DETECTED' } as unknown as VersionReadyEvent);

    expect(snackBarSpy.open).not.toHaveBeenCalled();
  });

  it('should not subscribe when SwUpdate is disabled', () => {
    const { service, versionUpdates$, snackBarSpy } = setupPwaUpdateService({ isEnabled: false });
    service.init();

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc' },
      latestVersion: { hash: 'def' },
    });

    expect(snackBarSpy.open).not.toHaveBeenCalled();
  });

  it('should call activateUpdate on snackbar action', async () => {
    const { service, versionUpdates$, snackBarAction$, activateUpdateSpy } =
      setupPwaUpdateService();
    service.init();

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc' },
      latestVersion: { hash: 'def' },
    });

    snackBarAction$.next();
    await vi.waitFor(() => {
      expect(activateUpdateSpy).toHaveBeenCalled();
    });
  });

  it('should show error snackbar when activateUpdate fails', async () => {
    const { service, versionUpdates$, snackBarSpy, snackBarAction$ } = setupPwaUpdateService({
      activateUpdate: vi.fn().mockRejectedValue(new Error('SW error')),
    });
    service.init();

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc' },
      latestVersion: { hash: 'def' },
    });

    snackBarAction$.next();
    await vi.waitFor(() => {
      expect(snackBarSpy.open).toHaveBeenCalledWith('更新失敗，請重新整理頁面', '', {
        duration: 5000,
      });
    });
  });

  it('should show snackbar on unrecoverable state', () => {
    const { service, unrecoverable$, snackBarSpy } = setupPwaUpdateService();
    service.init();

    unrecoverable$.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' });

    expect(snackBarSpy.open).toHaveBeenCalledWith('應用程式發生錯誤，將重新載入', '', {
      duration: 3000,
    });
  });
});
