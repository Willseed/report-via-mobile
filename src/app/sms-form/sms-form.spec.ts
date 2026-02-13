import { ComponentFixture, DeferBlockState, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { SmsForm, DISTRICT_SEARCH_DEBOUNCE_MS } from './sms-form';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS, findStationByAddress } from '../police-stations';
import { GeocodingService } from '../geocoding.service';

describe('SmsForm', () => {
  let component: SmsForm;
  let fixture: ComponentFixture<SmsForm>;
  let smsServiceSpy: {
    sendSms: ReturnType<typeof vi.fn>;
    generateSmsLink: ReturnType<typeof vi.fn>;
    isDesktop: ReturnType<typeof vi.fn>;
  };
  let geocodingServiceSpy: {
    getCurrentPosition: ReturnType<typeof vi.fn>;
    reverseGeocode: ReturnType<typeof vi.fn>;
  };
  let dialogSpy: { open: ReturnType<typeof vi.fn> };
  let afterClosedSubject: Subject<boolean | undefined>;

  beforeEach(async () => {
    afterClosedSubject = new Subject<boolean | undefined>();
    smsServiceSpy = {
      sendSms: vi.fn(),
      generateSmsLink: vi.fn().mockReturnValue('sms:0911510914?body=Hello'),
      isDesktop: vi.fn().mockReturnValue(false),
    };
    geocodingServiceSpy = {
      getCurrentPosition: vi.fn(),
      reverseGeocode: vi.fn(),
    };
    dialogSpy = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => afterClosedSubject.asObservable(),
      } as Partial<MatDialogRef<unknown>>),
    };

    await TestBed.configureTestingModule({
      imports: [SmsForm],
      providers: [
        { provide: SmsService, useValue: smsServiceSpy },
        { provide: GeocodingService, useValue: geocodingServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
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

  it('should accept valid form values with all required fields', () => {
    component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
    component['smsForm'].controls.district.setValue(POLICE_STATIONS[0]);
    component['smsForm'].controls.violation.setValue('汽車於紅線停車');
    expect(component['smsForm'].valid).toBe(true);
  });

  it('should return districtValue from district control', () => {
    expect(component['districtValue']()).toBeNull();

    component['smsForm'].controls.district.setValue(POLICE_STATIONS[0]);
    expect(component['districtValue']()).toBe(POLICE_STATIONS[0]);
  });

  it('should open confirm dialog on valid submit', () => {
    const station = POLICE_STATIONS[0];
    component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
    component['smsForm'].controls.district.setValue(station);
    component['smsForm'].controls.violation.setValue('汽車於紅線停車');

    component['sendSms']();
    expect(dialogSpy.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          stationName: station.stationName,
          phoneNumber: station.phoneNumber,
          message: '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
        },
      }),
    );
  });

  it('should call sendSms after dialog is confirmed', () => {
    const station = POLICE_STATIONS[0];
    component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
    component['smsForm'].controls.district.setValue(station);
    component['smsForm'].controls.violation.setValue('汽車於紅線停車');

    component['sendSms']();
    afterClosedSubject.next(true);

    expect(smsServiceSpy.sendSms).toHaveBeenCalledWith(
      station.phoneNumber,
      '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
    );
  });

  it('should not call sendSms when dialog is cancelled', () => {
    const station = POLICE_STATIONS[0];
    component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
    component['smsForm'].controls.district.setValue(station);
    component['smsForm'].controls.violation.setValue('汽車於紅線停車');

    component['sendSms']();
    afterClosedSubject.next(false);

    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should not call sendSms when dialog is dismissed (backdrop click)', () => {
    const station = POLICE_STATIONS[0];
    component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
    component['smsForm'].controls.district.setValue(station);
    component['smsForm'].controls.violation.setValue('汽車於紅線停車');

    component['sendSms']();
    afterClosedSubject.next(undefined);

    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should not open dialog when form is invalid', () => {
    component['sendSms']();
    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  it('should not open dialog when district mismatches even if form is valid', () => {
    component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
    component['smsForm'].controls.violation.setValue('汽車於紅線停車');
    const kaohsiungStation = POLICE_STATIONS.find((s) => s.district === '高雄市')!;
    component['smsForm'].controls.district.setValue(kaohsiungStation);

    component['sendSms']();
    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  describe('address input and auto-select district', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-select district when address contains district name', () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(component['smsForm'].controls.district.value).toEqual(POLICE_STATIONS[0]);
    });

    it('should auto-select district with 台 → 臺 normalization', () => {
      component['smsForm'].controls.address.setValue('台中市西屯區某路');
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      const taichungStation = POLICE_STATIONS.find((s) => s.district === '臺中市');
      expect(component['smsForm'].controls.district.value).toEqual(taichungStation);
    });

    it('should not change district when address does not match', () => {
      component['smsForm'].controls.address.setValue('某個不存在的地方');
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(component['smsForm'].controls.district.value).toBeNull();
    });

    it('should debounce rapid address inputs', () => {
      component['smsForm'].controls.address.setValue('臺北');
      vi.advanceTimersByTime(100);
      expect(component['smsForm'].controls.district.value).toBeNull();

      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(component['smsForm'].controls.district.value).toEqual(POLICE_STATIONS[0]);
    });
  });

  describe('districtMismatch', () => {
    it('should detect mismatch when address district differs from selected district', () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      const kaohsiungStation = POLICE_STATIONS.find((s) => s.district === '高雄市')!;
      component['smsForm'].controls.district.setValue(kaohsiungStation);
      expect(component['districtMismatch']()).toBe(true);
    });

    it('should not detect mismatch when address and district match', () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      component['smsForm'].controls.district.setValue(POLICE_STATIONS[0]);
      expect(component['districtMismatch']()).toBe(false);
    });

    it('should not detect mismatch when address has no recognizable district', () => {
      component['smsForm'].controls.address.setValue('某個不存在的地方');
      component['smsForm'].controls.district.setValue(POLICE_STATIONS[0]);
      expect(component['districtMismatch']()).toBe(false);
    });

    it('should not detect mismatch when no district is selected', () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      expect(component['districtMismatch']()).toBe(false);
    });

    it('should disable submit button when district mismatches', async () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      const kaohsiungStation = POLICE_STATIONS.find((s) => s.district === '高雄市')!;
      component['smsForm'].controls.district.setValue(kaohsiungStation);
      const deferBlock = (await fixture.getDeferBlocks())[0];
      await deferBlock.render(DeferBlockState.Complete);
      fixture.detectChanges();
      const button = (fixture.nativeElement as HTMLElement).querySelector(
        'button[mat-flat-button]',
      ) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });

    it('should show warning message when district mismatches', async () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      const kaohsiungStation = POLICE_STATIONS.find((s) => s.district === '高雄市')!;
      component['smsForm'].controls.district.setValue(kaohsiungStation);
      const deferBlock = (await fixture.getDeferBlocks())[0];
      await deferBlock.render(DeferBlockState.Complete);
      fixture.detectChanges();
      const warning = (fixture.nativeElement as HTMLElement).querySelector(
        '.district-mismatch-warning',
      );
      expect(warning).toBeTruthy();
    });

    it('should not show warning when district matches', async () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      component['smsForm'].controls.district.setValue(POLICE_STATIONS[0]);
      const deferBlock = (await fixture.getDeferBlocks())[0];
      await deferBlock.render(DeferBlockState.Complete);
      fixture.detectChanges();
      const warning = (fixture.nativeElement as HTMLElement).querySelector(
        '.district-mismatch-warning',
      );
      expect(warning).toBeNull();
    });
  });

  describe('composedMessage', () => {
    it('should compose message from address and violation', () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      component['smsForm'].controls.violation.setValue('汽車於紅線停車');
      expect(component['composedMessage']()).toBe(
        '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
      );
    });

    it('should return empty string when address is missing', () => {
      component['smsForm'].controls.violation.setValue('汽車於紅線停車');
      expect(component['composedMessage']()).toBe('');
    });

    it('should return empty string when violation is missing', () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      expect(component['composedMessage']()).toBe('');
    });
  });

  describe('sms preview', () => {
    it('should show preview when address and violation are filled', async () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      component['smsForm'].controls.violation.setValue('汽車於紅線停車');
      const deferBlock = (await fixture.getDeferBlocks())[0];
      await deferBlock.render(DeferBlockState.Complete);
      fixture.detectChanges();
      const preview = (fixture.nativeElement as HTMLElement).querySelector('.sms-preview');
      expect(preview).toBeTruthy();
    });

    it('should hide preview when address is empty', async () => {
      component['smsForm'].controls.violation.setValue('汽車於紅線停車');
      const deferBlock = (await fixture.getDeferBlocks())[0];
      await deferBlock.render(DeferBlockState.Complete);
      fixture.detectChanges();
      const preview = (fixture.nativeElement as HTMLElement).querySelector('.sms-preview');
      expect(preview).toBeNull();
    });

    it('should hide preview when violation is empty', async () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      const deferBlock = (await fixture.getDeferBlocks())[0];
      await deferBlock.render(DeferBlockState.Complete);
      fixture.detectChanges();
      const preview = (fixture.nativeElement as HTMLElement).querySelector('.sms-preview');
      expect(preview).toBeNull();
    });

    it('should display composed message in bubble', async () => {
      component['smsForm'].controls.address.setValue('臺北市信義區信義路五段7號');
      component['smsForm'].controls.violation.setValue('汽車於紅線停車');
      const deferBlock = (await fixture.getDeferBlocks())[0];
      await deferBlock.render(DeferBlockState.Complete);
      fixture.detectChanges();
      const bubble = (fixture.nativeElement as HTMLElement).querySelector('.sms-bubble');
      expect(bubble?.textContent?.trim()).toBe(
        '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
      );
    });
  });

  describe('filteredViolations', () => {
    it('should return all violations when filter is empty', () => {
      expect(component['filteredViolations']().length).toBe(21);
    });

    it('should filter violations by keyword', () => {
      component['violationFilter'].set('紅線');
      expect(component['filteredViolations']()).toEqual(['汽車於紅線停車', '機車於紅線停車']);
    });

    it('should filter by vehicle type', () => {
      component['violationFilter'].set('機車');
      expect(component['filteredViolations']().length).toBe(7);
      expect(component['filteredViolations']().every((v) => v.startsWith('機車'))).toBe(true);
    });

    it('should return all violations when filter matches an exact option', () => {
      component['violationFilter'].set('汽車於紅線停車');
      expect(component['filteredViolations']().length).toBe(21);
    });

    it('should include car-only violation for disabled parking space', () => {
      component['violationFilter'].set('殘障');
      const results = component['filteredViolations']();
      expect(results).toEqual(['汽車違法佔用殘障車位']);
    });

    it('should not include car-only violations for motorcycles', () => {
      const violations = component['filteredViolations']();
      expect(violations).not.toContain('機車違法佔用殘障車位');
      expect(violations).toContain('汽車違法佔用殘障車位');
    });
  });

  describe('smsOverLimit', () => {
    it('should detect when message exceeds 70 characters', () => {
      const longAddress = '臺北市信義區信義路五段某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某號';
      component['smsForm'].controls.address.setValue(longAddress);
      component['smsForm'].controls.violation.setValue('汽車於紅線停車');
      expect(component['composedMessage']().length).toBeGreaterThan(70);
      expect(component['smsOverLimit']()).toBe(true);
    });

    it('should not flag when message is within limit', () => {
      component['smsForm'].controls.address.setValue('臺北市信義路');
      component['smsForm'].controls.violation.setValue('汽車於紅線停車');
      expect(component['smsOverLimit']()).toBe(false);
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

    it('should skip when already locating (race condition guard)', async () => {
      let resolvePosition!: (value: GeolocationPosition) => void;
      geocodingServiceSpy.getCurrentPosition.mockReturnValue(
        new Promise((resolve) => {
          resolvePosition = resolve;
        }),
      );
      geocodingServiceSpy.reverseGeocode.mockResolvedValue('臺北市信義區');

      const promise1 = component['locateUser']();
      expect(component['isLocating']()).toBe(true);

      // Second call should be ignored
      const promise2 = component['locateUser']();

      resolvePosition({ coords: { latitude: 25, longitude: 121 } } as GeolocationPosition);
      await promise1;
      await promise2;

      expect(geocodingServiceSpy.getCurrentPosition).toHaveBeenCalledTimes(1);
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

describe('SmsForm desktop behavior', () => {
  let fixture: ComponentFixture<SmsForm>;

  beforeEach(async () => {
    const afterClosedSubject = new Subject<boolean | undefined>();
    await TestBed.configureTestingModule({
      imports: [SmsForm],
      providers: [
        {
          provide: SmsService,
          useValue: {
            sendSms: vi.fn(),
            generateSmsLink: vi.fn().mockReturnValue('sms:0911510914?body=Hello'),
            isDesktop: vi.fn().mockReturnValue(true),
          },
        },
        {
          provide: GeocodingService,
          useValue: { getCurrentPosition: vi.fn(), reverseGeocode: vi.fn() },
        },
        {
          provide: MatDialog,
          useValue: {
            open: vi.fn().mockReturnValue({
              afterClosed: () => afterClosedSubject.asObservable(),
            }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SmsForm);
    fixture.detectChanges();
  });

  it('should show desktop warning when on desktop', () => {
    const warning = (fixture.nativeElement as HTMLElement).querySelector('.desktop-warning');
    expect(warning).toBeTruthy();
    expect(warning?.textContent).toContain('簡訊連結可能無法在桌面瀏覽器上使用');
  });

  it('should disable submit button when on desktop', async () => {
    const deferBlock = (await fixture.getDeferBlocks())[0];
    await deferBlock.render(DeferBlockState.Complete);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button[mat-flat-button]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
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
