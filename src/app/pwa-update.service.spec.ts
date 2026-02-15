import { TestBed } from '@angular/core/testing';
import { SwUpdate, UnrecoverableStateEvent, VersionReadyEvent } from '@angular/service-worker';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { describe, it, expect, vi } from 'vitest';
import { Subject } from 'rxjs';
import { PwaUpdateService } from './pwa-update.service';

describe('PwaUpdateService', () => {
  let service: PwaUpdateService;
  let versionUpdates$: Subject<VersionReadyEvent>;
  let unrecoverable$: Subject<UnrecoverableStateEvent>;
  let snackBarSpy: { open: ReturnType<typeof vi.fn> };
  let snackBarAction$: Subject<void>;
  let activateUpdateSpy: ReturnType<typeof vi.fn>;

  function setup(options: { isEnabled?: boolean; activateUpdate?: ReturnType<typeof vi.fn> } = {}) {
    const { isEnabled = true, activateUpdate } = options;
    versionUpdates$ = new Subject();
    unrecoverable$ = new Subject();
    snackBarAction$ = new Subject();
    activateUpdateSpy = activateUpdate ?? vi.fn().mockResolvedValue(undefined);
    snackBarSpy = {
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
    service = TestBed.inject(PwaUpdateService);
  }

  it('should be created', () => {
    setup();
    expect(service).toBeTruthy();
  });

  it('should show snackbar when VERSION_READY event fires', () => {
    setup();
    service.init();

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc' },
      latestVersion: { hash: 'def' },
    } as VersionReadyEvent);

    expect(snackBarSpy.open).toHaveBeenCalledWith('有新版本可用', '更新', { duration: 0 });
  });

  it('should not show snackbar for non-VERSION_READY events', () => {
    setup();
    service.init();

    versionUpdates$.next({ type: 'VERSION_DETECTED' } as unknown as VersionReadyEvent);

    expect(snackBarSpy.open).not.toHaveBeenCalled();
  });

  it('should not subscribe when SwUpdate is disabled', () => {
    setup({ isEnabled: false });
    service.init();

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc' },
      latestVersion: { hash: 'def' },
    } as VersionReadyEvent);

    expect(snackBarSpy.open).not.toHaveBeenCalled();
  });

  it('should call activateUpdate on snackbar action', async () => {
    setup();
    service.init();

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc' },
      latestVersion: { hash: 'def' },
    } as VersionReadyEvent);

    snackBarAction$.next();
    await vi.waitFor(() => {
      expect(activateUpdateSpy).toHaveBeenCalled();
    });
  });

  it('should show error snackbar when activateUpdate fails', async () => {
    setup({ activateUpdate: vi.fn().mockRejectedValue(new Error('SW error')) });
    service.init();

    versionUpdates$.next({
      type: 'VERSION_READY',
      currentVersion: { hash: 'abc' },
      latestVersion: { hash: 'def' },
    } as VersionReadyEvent);

    snackBarAction$.next();
    await vi.waitFor(() => {
      expect(snackBarSpy.open).toHaveBeenCalledWith('更新失敗，請重新整理頁面', '', { duration: 5000 });
    });
  });

  it('should show snackbar on unrecoverable state', () => {
    setup();
    service.init();

    unrecoverable$.next({ type: 'UNRECOVERABLE_STATE', reason: 'hash mismatch' } as UnrecoverableStateEvent);

    expect(snackBarSpy.open).toHaveBeenCalledWith('應用程式發生錯誤，將重新載入', '', { duration: 3000 });
  });
});
