import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

describe('ConfirmDialog', () => {
  let component: ConfirmDialog;
  let fixture: ComponentFixture<ConfirmDialog>;
  let dialogRefSpy: { close: ReturnType<typeof import('vitest').vi.fn> };

  const mockData: ConfirmDialogData = {
    stationName: '臺北市政府警察局',
    phoneNumber: '0911510914',
    message: '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
  };

  beforeEach(async () => {
    dialogRefSpy = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [ConfirmDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: mockData },
        { provide: MatDialogRef, useValue: dialogRefSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display station name', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('臺北市政府警察局');
  });

  it('should display phone number', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('0911510914');
  });

  it('should display message', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理');
  });

  it('should display dialog title', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('確認發送簡訊');
  });

  it('should close with true when confirm is clicked', () => {
    component['confirm']();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('should close with false when cancel is clicked', () => {
    component['cancel']();
    expect(dialogRefSpy.close).toHaveBeenCalledWith(false);
  });

  it('should have confirm button with send text', () => {
    const el = fixture.nativeElement as HTMLElement;
    const confirmBtn = el.querySelector('button[mat-flat-button]');
    expect(confirmBtn?.textContent).toContain('確認發送');
  });

  it('should have cancel button', () => {
    const el = fixture.nativeElement as HTMLElement;
    const cancelBtn = el.querySelector('button[mat-button]');
    expect(cancelBtn?.textContent).toContain('取消');
  });
});
