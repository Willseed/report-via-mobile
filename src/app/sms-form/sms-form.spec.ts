import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { SmsForm } from './sms-form';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS, findStationByAddress } from '../police-stations';
import { GeocodingService } from '../geocoding.service';

describe('SmsForm', () => {
  let component: SmsForm;
  let fixture: ComponentFixture<SmsForm>;
  let smsServiceSpy: {
    generateSmsLink: ReturnType<typeof vi.fn>;
    isDesktop: ReturnType<typeof vi.fn>;
  };
  let geocodingServiceSpy: {
    getCurrentPosition: ReturnType<typeof vi.fn>;
    reverseGeocode: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    smsServiceSpy = {
      generateSmsLink: vi.fn().mockReturnValue('sms:0911510914?body=Hello'),
      isDesktop: vi.fn().mockReturnValue(false),
    };
    geocodingServiceSpy = {
      getCurrentPosition: vi.fn(),
      reverseGeocode: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SmsForm],
      providers: [
        provideNoopAnimations(),
        { provide: SmsService, useValue: smsServiceSpy },
        { provide: GeocodingService, useValue: geocodingServiceSpy },
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

  describe('address input and auto-select district', () => {
    it('should auto-select district when address contains district name', () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      component['onAddressInput']();
      expect(component['smsForm'].controls.district.value).toEqual(POLICE_STATIONS[0]);
    });

    it('should auto-select district with 台 → 臺 normalization', () => {
      component['smsForm'].controls.address.setValue('台中市西屯區某路');
      component['onAddressInput']();
      const taichungStation = POLICE_STATIONS.find((s) => s.district === '臺中市');
      expect(component['smsForm'].controls.district.value).toEqual(taichungStation);
    });

    it('should not change district when address does not match', () => {
      component['smsForm'].controls.address.setValue('某個不存在的地方');
      component['onAddressInput']();
      expect(component['smsForm'].controls.district.value).toBeNull();
    });
  });

  describe('violation select', () => {
    it('should populate message when violation is selected', () => {
      component['smsForm'].controls.violation.setValue('紅線停車');
      component['onViolationChange']();
      expect(component['smsForm'].controls.message.value).toBe('紅線停車');
    });

    it('should overwrite existing message when violation changes', () => {
      component['smsForm'].controls.message.setValue('舊內容');
      component['smsForm'].controls.violation.setValue('並排停車');
      component['onViolationChange']();
      expect(component['smsForm'].controls.message.value).toBe('並排停車');
    });
  });

  describe('sms preview', () => {
    it('should show preview when message has value', () => {
      component['smsForm'].controls.message.setValue('測試預覽');
      fixture.detectChanges();
      const preview = (fixture.nativeElement as HTMLElement).querySelector('.sms-preview');
      expect(preview).toBeTruthy();
    });

    it('should hide preview when message is empty', () => {
      component['smsForm'].controls.message.setValue('');
      fixture.detectChanges();
      const preview = (fixture.nativeElement as HTMLElement).querySelector('.sms-preview');
      expect(preview).toBeNull();
    });

    it('should display message content in bubble', () => {
      component['smsForm'].controls.message.setValue('簡訊內容測試');
      fixture.detectChanges();
      const bubble = (fixture.nativeElement as HTMLElement).querySelector('.sms-bubble');
      expect(bubble?.textContent?.trim()).toBe('簡訊內容測試');
    });
  });

  describe('locateUser', () => {
    it('should fill address and auto-select district on success', async () => {
      const mockPosition = {
        coords: { latitude: 25.033, longitude: 121.565 },
      } as GeolocationPosition;
      geocodingServiceSpy.getCurrentPosition.mockResolvedValue(mockPosition);
      geocodingServiceSpy.reverseGeocode.mockResolvedValue('臺北市信義區信義路五段7號');

      await component['locateUser']();

      expect(component['smsForm'].controls.address.value).toBe('臺北市信義區信義路五段7號');
      expect(component['smsForm'].controls.district.value).toEqual(POLICE_STATIONS[0]);
      expect(component['isLocating']()).toBe(false);
      expect(component['locationError']()).toBe('');
    });

    it('should show error message on failure', async () => {
      geocodingServiceSpy.getCurrentPosition.mockRejectedValue(new Error('定位權限被拒絕，請允許存取位置資訊。'));

      await component['locateUser']();

      expect(component['locationError']()).toBe('定位權限被拒絕，請允許存取位置資訊。');
      expect(component['isLocating']()).toBe(false);
    });

    it('should set isLocating during location process', async () => {
      let resolvePosition!: (value: GeolocationPosition) => void;
      geocodingServiceSpy.getCurrentPosition.mockReturnValue(
        new Promise((resolve) => {
          resolvePosition = resolve;
        }),
      );

      const promise = component['locateUser']();
      expect(component['isLocating']()).toBe(true);

      geocodingServiceSpy.reverseGeocode.mockResolvedValue('臺北市信義區');
      resolvePosition({ coords: { latitude: 25, longitude: 121 } } as GeolocationPosition);
      await promise;

      expect(component['isLocating']()).toBe(false);
    });
  });
});

describe('findStationByAddress', () => {
  it('should find station by district name', () => {
    const result = findStationByAddress('臺北市信義區信義路');
    expect(result).not.toBeNull();
    expect(result!.district).toBe('臺北市');
  });

  it('should normalize 台 to 臺', () => {
    const result = findStationByAddress('台中市西屯區');
    expect(result).not.toBeNull();
    expect(result!.district).toBe('臺中市');
  });

  it('should return null for unmatched address', () => {
    const result = findStationByAddress('某個不存在的地方');
    expect(result).toBeNull();
  });

  it('should match 台東縣 after normalization', () => {
    const result = findStationByAddress('台東縣太麻里鄉');
    expect(result).not.toBeNull();
    expect(result!.district).toBe('臺東縣');
  });
});
