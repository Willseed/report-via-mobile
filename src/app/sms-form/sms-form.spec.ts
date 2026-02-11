import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { SmsForm } from './sms-form';
import { SmsService } from '../sms.service';

describe('SmsForm', () => {
  let component: SmsForm;
  let fixture: ComponentFixture<SmsForm>;
  let smsServiceSpy: { generateSmsLink: ReturnType<typeof vi.fn>; isDesktop: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    smsServiceSpy = {
      generateSmsLink: vi.fn().mockReturnValue('sms:0912345678?body=Hello'),
      isDesktop: vi.fn().mockReturnValue(false),
    };

    await TestBed.configureTestingModule({
      imports: [SmsForm],
      providers: [
        provideNoopAnimations(),
        { provide: SmsService, useValue: smsServiceSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SmsForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have an invalid form when empty', () => {
    expect(component['smsForm'].valid).toBe(false);
  });

  it('should validate phone number pattern', () => {
    const recipientControl = component['smsForm'].controls.recipient;
    recipientControl.setValue('abc');
    expect(recipientControl.hasError('pattern')).toBe(true);

    recipientControl.setValue('+886912345678');
    expect(recipientControl.valid).toBe(true);
  });

  it('should accept valid form values', () => {
    component['smsForm'].controls.recipient.setValue('0912345678');
    component['smsForm'].controls.message.setValue('Test message');
    expect(component['smsForm'].valid).toBe(true);
  });

  it('should call generateSmsLink on valid submit', () => {
    component['smsForm'].controls.recipient.setValue('0912345678');
    component['smsForm'].controls.message.setValue('Hello');

    // Mock window.location.href
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });

    component['sendSms']();
    expect(smsServiceSpy.generateSmsLink).toHaveBeenCalledWith('0912345678', 'Hello');
  });

  it('should not submit when form is invalid', () => {
    component['sendSms']();
    expect(smsServiceSpy.generateSmsLink).not.toHaveBeenCalled();
  });
});
