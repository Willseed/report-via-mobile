import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { SwUpdate } from '@angular/service-worker';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY } from 'rxjs';
import { App } from './app';
import { NOMINATIM_USER_AGENT } from './app.config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: SwUpdate, useValue: { isEnabled: false, versionUpdates: EMPTY } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        provideHttpClient(),
        { provide: NOMINATIM_USER_AGENT, useValue: 'test' },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    fixture.destroy();
    expect(app).toBeTruthy();
  });
});
