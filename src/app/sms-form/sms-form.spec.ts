import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { SmsForm } from './sms-form';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS } from '../police-stations';

describe('SmsForm', () => {
  let component: SmsForm;
  let fixture: ComponentFixture<SmsForm>;
  let smsServiceSpy: {
    generateSmsLink: ReturnType<typeof vi.fn>;
    isDesktop: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    smsServiceSpy = {
      generateSmsLink: vi.fn().mockReturnValue('sms:0911510914?body=Hello'),
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

  it('should require district selection', () => {
    const districtControl = component['smsForm'].controls.district;
    expect(districtControl.hasError('required')).toBe(true);
  });

  it('should accept valid form values with district selected', () => {
    component['smsForm'].controls.district.setValue(POLICE_STATIONS[0]);
    component['smsForm'].controls.message.setValue('測試訊息');
    expect(component['smsForm'].valid).toBe(true);
  });

  it('should return selectedStation from district control', () => {
    expect(component['selectedStation']).toBeNull();

    component['smsForm'].controls.district.setValue(POLICE_STATIONS[0]);
    expect(component['selectedStation']).toBe(POLICE_STATIONS[0]);
  });

  it('should call generateSmsLink with correct phone number on valid submit', () => {
    const station = POLICE_STATIONS[0];
    component['smsForm'].controls.district.setValue(station);
    component['smsForm'].controls.message.setValue('報案內容');

    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });

    component['sendSms']();
    expect(smsServiceSpy.generateSmsLink).toHaveBeenCalledWith(station.phoneNumber, '報案內容');
  });

  it('should not submit when form is invalid', () => {
    component['sendSms']();
    expect(smsServiceSpy.generateSmsLink).not.toHaveBeenCalled();
  });
});
