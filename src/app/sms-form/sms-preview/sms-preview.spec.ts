import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SmsPreview, SMS_CHAR_LIMIT } from './sms-preview';

describe('SmsPreview', () => {
  let fixture: ComponentFixture<SmsPreview>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SmsPreview] });
  });

  function createComponent(message: string): ComponentFixture<SmsPreview> {
    fixture = TestBed.createComponent(SmsPreview);
    fixture.componentRef.setInput('message', message);
    fixture.detectChanges();
    return fixture;
  }

  /**
   * Returns the root HTML element of the test fixture.
   * This function is only used to query rendered DOM, never to return raw HTML strings.
   */
  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('should create', () => {
    createComponent('測試訊息');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should not render when message is empty', () => {
    createComponent('');
    expect(el().querySelector('.sms-preview')).toBeNull();
  });

  it('should display the message in the sms-bubble', () => {
    const msg = '這是一則測試簡訊';
    createComponent(msg);
    expect(el().querySelector<HTMLElement>('.sms-bubble')!.textContent!.trim()).toBe(msg);
  });

  it('should show character count', () => {
    const msg = '測試';
    createComponent(msg);
    const countEl = el().querySelector<HTMLElement>('.sms-char-count')!;
    expect(countEl.textContent!.trim()).toBe(`${msg.length} / ${SMS_CHAR_LIMIT} 字`);
  });

  it('should not show over-limit warning when under limit', () => {
    createComponent('短訊');
    expect(el().querySelector('.sms-length-warning')).toBeNull();
  });

  it('should show over-limit warning when message exceeds 70 chars', () => {
    const msg = '字'.repeat(SMS_CHAR_LIMIT + 1);
    createComponent(msg);
    const warning = el().querySelector<HTMLElement>('.sms-length-warning');
    expect(warning).not.toBeNull();
    expect(warning!.getAttribute('role')).toBe('alert');
  });

  it('should add over-limit class to char count when exceeding limit', () => {
    const msg = '字'.repeat(SMS_CHAR_LIMIT + 1);
    createComponent(msg);
    const countEl = el().querySelector<HTMLElement>('.sms-char-count')!;
    expect(countEl.classList.contains('over-limit')).toBe(true);
  });

  it('should compute overLimit correctly at boundary', () => {
    // Exactly 70 chars → not over limit
    createComponent('字'.repeat(SMS_CHAR_LIMIT));
    expect(fixture.componentInstance['overLimit']()).toBe(false);
    expect(el().querySelector('.sms-length-warning')).toBeNull();

    // 71 chars → over limit
    fixture.componentRef.setInput('message', '字'.repeat(SMS_CHAR_LIMIT + 1));
    fixture.detectChanges();
    expect(fixture.componentInstance['overLimit']()).toBe(true);
    expect(el().querySelector('.sms-length-warning')).not.toBeNull();
  });
});
