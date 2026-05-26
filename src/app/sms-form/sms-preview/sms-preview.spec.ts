import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SmsPreview, SMS_CHAR_LIMIT } from './sms-preview';

function createComponent(message: string): ComponentFixture<SmsPreview> {
  const fixture = TestBed.createComponent(SmsPreview);
  fixture.componentRef.setInput('message', message);
  fixture.detectChanges();
  return fixture;
}

/**
 * Returns the root DOM element of the test fixture for querying rendered output.
 */
function getHostHtmlElement(fixture: ComponentFixture<SmsPreview>): HTMLElement {
  return fixture.nativeElement;
}

describe('SmsPreview', () => {
  let fixture: ComponentFixture<SmsPreview>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [SmsPreview] });
  });

  it('should create', () => {
    fixture = createComponent('測試訊息');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should not render when message is empty', () => {
    fixture = createComponent('');
    expect(getHostHtmlElement(fixture).querySelector('.sms-preview')).toBeNull();
  });

  it('should display the message in the sms-bubble', () => {
    const msg = '這是一則測試簡訊';
    fixture = createComponent(msg);
    const bubble = getHostHtmlElement(fixture).querySelector<HTMLElement>('.sms-bubble');
    expect(bubble).toBeTruthy();
    expect(bubble?.textContent?.trim()).toBe(msg);
  });

  it('should show character count', () => {
    const msg = '測試';
    fixture = createComponent(msg);
    const countEl = getHostHtmlElement(fixture).querySelector<HTMLElement>('.sms-char-count');
    expect(countEl).toBeTruthy();
    expect(countEl?.textContent?.trim()).toBe(`${msg.length} / ${SMS_CHAR_LIMIT} 字`);
  });

  it('should not show over-limit warning when under limit', () => {
    fixture = createComponent('短訊');
    expect(getHostHtmlElement(fixture).querySelector('.sms-length-warning')).toBeNull();
  });

  it('should show over-limit warning when message exceeds 70 chars', () => {
    const msg = '字'.repeat(SMS_CHAR_LIMIT + 1);
    fixture = createComponent(msg);
    const warning = getHostHtmlElement(fixture).querySelector<HTMLElement>('.sms-length-warning');
    expect(warning).toBeTruthy();
    expect(warning?.getAttribute('role')).toBe('alert');
  });

  it('should add over-limit class to char count when exceeding limit', () => {
    const msg = '字'.repeat(SMS_CHAR_LIMIT + 1);
    fixture = createComponent(msg);
    const countEl = getHostHtmlElement(fixture).querySelector<HTMLElement>('.sms-char-count');
    expect(countEl).toBeTruthy();
    expect(countEl?.classList.contains('over-limit')).toBe(true);
  });

  it('should compute overLimit correctly at boundary', () => {
    // Exactly 70 chars → not over limit
    fixture = createComponent('字'.repeat(SMS_CHAR_LIMIT));
    expect(fixture.componentInstance['overLimit']()).toBe(false);
    expect(getHostHtmlElement(fixture).querySelector('.sms-length-warning')).toBeNull();

    // 71 chars → over limit
    fixture.componentRef.setInput('message', '字'.repeat(SMS_CHAR_LIMIT + 1));
    fixture.detectChanges();
    expect(fixture.componentInstance['overLimit']()).toBe(true);
    expect(getHostHtmlElement(fixture).querySelector('.sms-length-warning')).not.toBeNull();
  });
});
