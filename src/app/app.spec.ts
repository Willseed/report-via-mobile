import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SwUpdate } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY } from 'rxjs';
import { App } from './app';

describe('App', () => {
  let requestIdleCallbackSpy: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    requestIdleCallbackSpy = vi.fn((callback: IdleRequestCallback) => {
        callback({ didTimeout: false, timeRemaining: () => 0 });
        return 1;
      });
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      writable: true,
      value: requestIdleCallbackSpy,
    });

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: EMPTY } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    fixture.destroy();
    expect(app).toBeTruthy();
    expect(app).toBeTruthy();
    expect(requestIdleCallbackSpy).toHaveBeenCalledOnce();
  });
});
