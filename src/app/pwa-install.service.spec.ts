import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Subject } from 'rxjs';
import { PwaInstallService } from './pwa-install.service';

describe('PwaInstallService', () => {
  let service: PwaInstallService;
  let snackBarSpy: { open: ReturnType<typeof vi.fn> };
  let snackBarAction$: Subject<void>;

  beforeEach(() => {
    snackBarAction$ = new Subject();
    snackBarSpy = {
      open: vi.fn().mockReturnValue({
        onAction: () => snackBarAction$,
      } as unknown as MatSnackBarRef<TextOnlySnackBar>),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: MatSnackBar, useValue: snackBarSpy }],
    });
    service = TestBed.inject(PwaInstallService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initially have canInstall as null', () => {
    expect(service.canInstall()).toBeNull();
  });

  it('should capture beforeinstallprompt event and show snackbar', () => {
    service.init();

    const mockEvent = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<{ outcome: string }>;
    };
    mockEvent.prompt = vi.fn().mockResolvedValue({ outcome: 'accepted' });
    const preventDefaultSpy = vi.fn();
    Object.defineProperty(mockEvent, 'preventDefault', { value: preventDefaultSpy });

    window.dispatchEvent(mockEvent);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(service.canInstall()).toBeTruthy();
    expect(snackBarSpy.open).toHaveBeenCalledWith('可將此應用安裝至主畫面', '安裝', {
      duration: 8000,
    });
  });

  it('should call prompt on promptInstall and clear deferredPrompt on accepted', async () => {
    service.init();

    const promptFn = vi.fn().mockResolvedValue({ outcome: 'accepted' });
    const mockEvent = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<{ outcome: string }>;
    };
    mockEvent.prompt = promptFn;
    Object.defineProperty(mockEvent, 'preventDefault', { value: vi.fn() });

    window.dispatchEvent(mockEvent);
    expect(service.canInstall()).toBeTruthy();

    await service.promptInstall();
    expect(promptFn).toHaveBeenCalled();
    expect(service.canInstall()).toBeNull();
  });

  it('should always clear deferredPrompt after promptInstall', async () => {
    service.init();

    const promptFn = vi.fn().mockResolvedValue({ outcome: 'dismissed' });
    const mockEvent = new Event('beforeinstallprompt') as Event & {
      prompt: () => Promise<{ outcome: string }>;
    };
    mockEvent.prompt = promptFn;
    Object.defineProperty(mockEvent, 'preventDefault', { value: vi.fn() });

    window.dispatchEvent(mockEvent);

    await service.promptInstall();
    expect(service.canInstall()).toBeNull();
  });

  it('should do nothing when promptInstall is called without deferred prompt', async () => {
    await service.promptInstall();
    expect(service.canInstall()).toBeNull();
  });
});
