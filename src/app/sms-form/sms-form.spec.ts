import { ComponentFixture, DeferBlockState, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Subject } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { SmsForm, DISTRICT_SEARCH_DEBOUNCE_MS } from './sms-form';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS, findStationByAddress } from '../police-stations';
import { GeocodingService } from '../geocoding.service';
import { LocationInput } from './location-input/location-input';
import { ViolationInput } from './violation-input/violation-input';

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

  const kaohsiungStation = POLICE_STATIONS.find((s) => s.district === '高雄市')!;

  function getLocationInput(): LocationInput {
    return component['locationInput']()!;
  }

  function getViolationInput(): ViolationInput {
    return component['violationInput']()!;
  }

  function fillValidForm(station = POLICE_STATIONS[0]) {
    const loc = getLocationInput();
    loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
    loc['address'].set('臺北市信義區信義路五段7號');
    loc['district'].set(station);
    const vi = getViolationInput();
    vi['violationForm'].violation().value.set('汽車於紅線停車');
    vi['violation'].set('汽車於紅線停車');
  }

  async function renderDeferBlock() {
    const deferBlock = (await fixture.getDeferBlocks())[0];
    await deferBlock.render(DeferBlockState.Complete);
    fixture.detectChanges();
  }

  function mockPendingPosition() {
    let resolvePosition!: (value: GeolocationPosition) => void;
    geocodingServiceSpy.getCurrentPosition.mockReturnValue(
      new Promise((resolve) => {
        resolvePosition = resolve;
      }),
    );
    return resolvePosition;
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have an invalid form when empty', async () => {
    await renderDeferBlock();
    expect(getLocationInput().valid).toBe(false);
  });

  it('should require district selection', async () => {
    await renderDeferBlock();
    expect(getLocationInput()['district']()).toBeNull();
    expect(getLocationInput().districtRequired).toBe(true);
  });

  it('should accept valid form values with all required fields', async () => {
    await renderDeferBlock();
    fillValidForm();
    expect(getLocationInput().valid).toBe(true);
    expect(getViolationInput().valid).toBe(true);
  });

  it('should return district from location input', async () => {
    await renderDeferBlock();
    expect(component['district']()).toBeNull();

    getLocationInput()['district'].set(POLICE_STATIONS[0]);
    expect(component['district']()).toBe(POLICE_STATIONS[0]);
  });

  it('should open confirm dialog on valid submit', async () => {
    await renderDeferBlock();
    fillValidForm();

    component['sendSms']();
    expect(dialogSpy.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          stationName: POLICE_STATIONS[0].stationName,
          phoneNumber: POLICE_STATIONS[0].phoneNumber,
          message: '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
        },
      }),
    );
  });

  it('should call sendSms after dialog is confirmed', async () => {
    await renderDeferBlock();
    fillValidForm();

    component['sendSms']();
    afterClosedSubject.next(true);

    expect(smsServiceSpy.sendSms).toHaveBeenCalledWith(
      POLICE_STATIONS[0].phoneNumber,
      '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
    );
  });

  it('should not call sendSms when dialog is cancelled', async () => {
    await renderDeferBlock();
    fillValidForm();

    component['sendSms']();
    afterClosedSubject.next(false);

    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should not call sendSms when dialog is dismissed (backdrop click)', async () => {
    await renderDeferBlock();
    fillValidForm();

    component['sendSms']();
    afterClosedSubject.next(undefined);

    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should not open dialog when form is invalid', async () => {
    await renderDeferBlock();
    component['sendSms']();
    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  it('should not open dialog when district mismatches even if form is valid', async () => {
    await renderDeferBlock();
    const loc = getLocationInput();
    loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
    loc['address'].set('臺北市信義區信義路五段7號');
    getViolationInput()['violationForm'].violation().value.set('汽車於紅線停車');
    getViolationInput()['violation'].set('汽車於紅線停車');
    loc['district'].set(kaohsiungStation);

    component['sendSms']();
    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  describe('address input and auto-select district', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      await renderDeferBlock();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-select district when address contains district name', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      loc['onAddressInput']();
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(loc['district']()).toEqual(POLICE_STATIONS[0]);
    });

    it('should auto-select district with 台 → 臺 normalization', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('台中市西屯區某路');
      loc['address'].set('台中市西屯區某路');
      loc['onAddressInput']();
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      const taichungStation = POLICE_STATIONS.find((s) => s.district === '臺中市');
      expect(loc['district']()).toEqual(taichungStation);
    });

    it('should not change district when address does not match', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('某個不存在的地方');
      loc['address'].set('某個不存在的地方');
      loc['onAddressInput']();
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(loc['district']()).toBeNull();
    });

    it('should debounce rapid address inputs', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北');
      loc['address'].set('臺北');
      loc['onAddressInput']();
      vi.advanceTimersByTime(100);
      expect(loc['district']()).toBeNull();

      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      loc['onAddressInput']();
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(loc['district']()).toEqual(POLICE_STATIONS[0]);
    });
  });

  describe('districtMismatch', () => {
    beforeEach(async () => {
      await renderDeferBlock();
    });

    it('should detect mismatch when address district differs from selected district', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      loc['district'].set(kaohsiungStation);
      expect(loc.districtMismatch()).toBe(true);
    });

    it('should not detect mismatch when address and district match', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      loc['district'].set(POLICE_STATIONS[0]);
      expect(loc.districtMismatch()).toBe(false);
    });

    it('should not detect mismatch when address has no recognizable district', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('某個不存在的地方');
      loc['address'].set('某個不存在的地方');
      loc['district'].set(POLICE_STATIONS[0]);
      expect(loc.districtMismatch()).toBe(false);
    });

    it('should not detect mismatch when no district is selected', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      expect(loc.districtMismatch()).toBe(false);
    });

    it('should disable submit button when district mismatches', async () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      loc['district'].set(kaohsiungStation);
      fixture.detectChanges();
      const buttonDebug = fixture.debugElement.query(
        (el) => el.name === 'button' && el.attributes['mat-flat-button'] !== undefined,
      );
      expect(buttonDebug.nativeElement.disabled).toBe(true);
    });

    it('should show warning message when district mismatches', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      loc['district'].set(kaohsiungStation);
      fixture.detectChanges();
      const warning = (fixture.nativeElement as HTMLElement).querySelector(
        '.district-mismatch-warning',
      );
      expect(warning).toBeTruthy();
    });

    it('should not show warning when district matches', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      loc['district'].set(POLICE_STATIONS[0]);
      fixture.detectChanges();
      const warning = (fixture.nativeElement as HTMLElement).querySelector(
        '.district-mismatch-warning',
      );
      expect(warning).toBeNull();
    });
  });

  describe('composedMessage', () => {
    beforeEach(async () => {
      await renderDeferBlock();
    });

    it('should compose message from address and violation', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      expect(component['composedMessage']()).toBe(
        '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
      );
    });

    it('should return empty string when address is missing', () => {
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      expect(component['composedMessage']()).toBe('');
    });

    it('should return empty string when violation is missing', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      expect(component['composedMessage']()).toBe('');
    });
  });

  describe('sms preview', () => {
    it('should show preview when address and violation are filled', async () => {
      await renderDeferBlock();
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      fixture.detectChanges();
      const preview = (fixture.nativeElement as HTMLElement).querySelector('.sms-preview');
      expect(preview).toBeTruthy();
    });

    it('should hide preview when address is empty', async () => {
      await renderDeferBlock();
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      fixture.detectChanges();
      const preview = (fixture.nativeElement as HTMLElement).querySelector('.sms-preview');
      expect(preview).toBeNull();
    });

    it('should hide preview when violation is empty', async () => {
      await renderDeferBlock();
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      fixture.detectChanges();
      const preview = (fixture.nativeElement as HTMLElement).querySelector('.sms-preview');
      expect(preview).toBeNull();
    });

    it('should display composed message in bubble', async () => {
      await renderDeferBlock();
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      fixture.detectChanges();
      const bubble = (fixture.nativeElement as HTMLElement).querySelector('.sms-bubble');
      expect(bubble?.textContent?.trim()).toBe(
        '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
      );
    });
  });

  describe('filteredViolations', () => {
    beforeEach(async () => {
      await renderDeferBlock();
    });

    it('should return all violations when filter is empty', () => {
      expect(getViolationInput()['filteredViolations']().length).toBe(21);
    });

    it('should filter violations by keyword', () => {
      getViolationInput()['violationFilter'].set('紅線');
      expect(getViolationInput()['filteredViolations']()).toEqual([
        '汽車於紅線停車',
        '機車於紅線停車',
      ]);
    });

    it('should filter by vehicle type', () => {
      const vi = getViolationInput();
      vi['violationFilter'].set('機車');
      expect(vi['filteredViolations']().length).toBe(7);
      expect(vi['filteredViolations']().every((v) => v.startsWith('機車'))).toBe(true);
    });

    it('should return all violations when filter matches an exact option', () => {
      getViolationInput()['violationFilter'].set('汽車於紅線停車');
      expect(getViolationInput()['filteredViolations']().length).toBe(21);
    });

    it('should include car-only violation for disabled parking space', () => {
      getViolationInput()['violationFilter'].set('殘障');
      const results = getViolationInput()['filteredViolations']();
      expect(results).toEqual(['汽車違法佔用殘障車位']);
    });

    it('should not include car-only violations for motorcycles', () => {
      const violations = getViolationInput()['filteredViolations']();
      expect(violations).not.toContain('機車違法佔用殘障車位');
      expect(violations).toContain('汽車違法佔用殘障車位');
    });
  });

  describe('smsOverLimit', () => {
    beforeEach(async () => {
      await renderDeferBlock();
    });

    it('should detect when message exceeds 70 characters', () => {
      const longAddress =
        '臺北市信義區信義路五段某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某號';
      const loc = getLocationInput();
      loc['addressForm'].address().value.set(longAddress);
      loc['address'].set(longAddress);
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      expect(component['composedMessage']().length).toBeGreaterThan(70);
    });

    it('should not flag when message is within limit', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義路');
      loc['address'].set('臺北市信義路');
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      expect(component['composedMessage']().length).toBeLessThanOrEqual(70);
    });
  });

  describe('locateUser', () => {
    beforeEach(async () => {
      await renderDeferBlock();
    });

    it('should fill address and auto-select district on success', async () => {
      const mockPosition = {
        coords: { latitude: 25.033, longitude: 121.565 },
      } as GeolocationPosition;
      geocodingServiceSpy.getCurrentPosition.mockResolvedValue(mockPosition);
      geocodingServiceSpy.reverseGeocode.mockResolvedValue('臺北市信義區信義路五段7號');

      await getLocationInput()['locateUser']();

      expect(getLocationInput()['addressForm'].address().value()).toBe(
        '臺北市信義區信義路五段7號',
      );
      expect(getLocationInput()['district']()).toEqual(POLICE_STATIONS[0]);
      expect(getLocationInput()['isLocating']()).toBe(false);
      expect(getLocationInput()['locationError']()).toBe('');
    });

    it('should show error message on failure', async () => {
      geocodingServiceSpy.getCurrentPosition.mockRejectedValue(
        new Error('定位權限被拒絕，請允許存取位置資訊。'),
      );

      await getLocationInput()['locateUser']();

      expect(getLocationInput()['locationError']()).toBe('定位權限被拒絕，請允許存取位置資訊。');
      expect(getLocationInput()['isLocating']()).toBe(false);
    });

    it('should skip when already locating (race condition guard)', async () => {
      const resolvePosition = mockPendingPosition();
      geocodingServiceSpy.reverseGeocode.mockResolvedValue('臺北市信義區');

      const loc = getLocationInput();
      const promise1 = loc['locateUser']();
      expect(loc['isLocating']()).toBe(true);

      const promise2 = loc['locateUser']();

      resolvePosition({ coords: { latitude: 25, longitude: 121 } } as GeolocationPosition);
      await promise1;
      await promise2;

      expect(geocodingServiceSpy.getCurrentPosition).toHaveBeenCalledTimes(1);
    });

    it('should set isLocating during location process', async () => {
      const resolvePosition = mockPendingPosition();

      const loc = getLocationInput();
      const promise = loc['locateUser']();
      expect(loc['isLocating']()).toBe(true);

      geocodingServiceSpy.reverseGeocode.mockResolvedValue('臺北市信義區');
      resolvePosition({ coords: { latitude: 25, longitude: 121 } } as GeolocationPosition);
      await promise;

      expect(loc['isLocating']()).toBe(false);
    });
  });

  describe('licensePlate', () => {
    beforeEach(async () => {
      await renderDeferBlock();
    });

    it('should not show license plate field by default', () => {
      expect(getViolationInput()['showLicensePlate']()).toBe(false);
    });

    it('should show license plate field after toggle', () => {
      getViolationInput()['toggleLicensePlate']();
      expect(getViolationInput()['showLicensePlate']()).toBe(true);
    });

    it('should hide field and clear value on clearLicensePlate', () => {
      const vi = getViolationInput();
      vi['toggleLicensePlate']();
      vi['violationForm'].licensePlate().value.set('ABC1234');
      vi['licensePlate'].set('ABC1234');
      vi['clearLicensePlate']();
      expect(vi['showLicensePlate']()).toBe(false);
      expect(vi['violationForm'].licensePlate().value()).toBe('');
    });

    it('should auto-uppercase and filter non-alphanumeric on input', () => {
      const vi = getViolationInput();
      vi['toggleLicensePlate']();
      const event = { target: { value: 'abc-123!' } } as unknown as Event;
      vi['onLicensePlateInput'](event);
      expect(vi['violationForm'].licensePlate().value()).toBe('ABC123');
    });

    it('should not modify value when input is already clean uppercase', () => {
      const vi = getViolationInput();
      vi['toggleLicensePlate']();
      vi['violationForm'].licensePlate().value.set('ABC1234');
      vi['licensePlate'].set('ABC1234');
      const event = { target: { value: 'ABC1234' } } as unknown as Event;
      vi['onLicensePlateInput'](event);
      expect(vi['violationForm'].licensePlate().value()).toBe('ABC1234');
    });

    it('should include plate in composed message when provided', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      vi['violationForm'].licensePlate().value.set('ABC1234');
      vi['licensePlate'].set('ABC1234');
      expect(component['composedMessage']()).toBe(
        '臺北市信義區信義路五段7號，有汽車於紅線停車，車牌號碼：ABC1234，請派員處理',
      );
    });

    it('should not include plate segment when plate is empty', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義區信義路五段7號');
      loc['address'].set('臺北市信義區信義路五段7號');
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      expect(component['composedMessage']()).toBe(
        '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
      );
    });

    it('should pass licensePlate to confirm dialog when present', () => {
      fillValidForm();
      const vi = getViolationInput();
      vi['violationForm'].licensePlate().value.set('XYZ9999');
      vi['licensePlate'].set('XYZ9999');

      component['sendSms']();
      expect(dialogSpy.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            licensePlate: 'XYZ9999',
          }),
        }),
      );
    });

    it('should not pass licensePlate to dialog when empty', () => {
      fillValidForm();

      component['sendSms']();
      expect(dialogSpy.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            licensePlate: undefined,
          }),
        }),
      );
    });

    it('should show add-plate button in template when not toggled', async () => {
      const btn = (fixture.nativeElement as HTMLElement).querySelector('.add-plate-btn');
      expect(btn).toBeTruthy();
      expect(btn?.textContent).toContain('新增車牌號碼');
    });

    it('should show license plate field after clicking add button', () => {
      getViolationInput()['toggleLicensePlate']();
      fixture.detectChanges();
      const field = (fixture.nativeElement as HTMLElement).querySelector(
        'input[placeholder="例：ABC1234"]',
      );
      expect(field).toBeTruthy();
    });

    it('should hide add-plate button when field is shown', () => {
      getViolationInput()['toggleLicensePlate']();
      fixture.detectChanges();
      const btn = (fixture.nativeElement as HTMLElement).querySelector('.add-plate-btn');
      expect(btn).toBeNull();
    });

    it('should keep form valid when license plate is empty (optional field)', () => {
      fillValidForm();
      expect(getLocationInput().valid).toBe(true);
      expect(getViolationInput().valid).toBe(true);
    });

    it('should keep form valid with a valid license plate', () => {
      fillValidForm();
      const vi = getViolationInput();
      vi['violationForm'].licensePlate().value.set('ABC1234');
      vi['licensePlate'].set('ABC1234');
      expect(vi.valid).toBe(true);
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
    expect(result?.district).toBe('臺北市');
  });

  it('should normalize 台 to 臺', () => {
    const result = findStationByAddress('台中市西屯區');
    expect(result).not.toBeNull();
    expect(result?.district).toBe('臺中市');
  });

  it('should return null for unmatched address', () => {
    const result = findStationByAddress('某個不存在的地方');
    expect(result).toBeNull();
  });

  it('should match 台東縣 after normalization', () => {
    const result = findStationByAddress('台東縣太麻里鄉');
    expect(result).not.toBeNull();
    expect(result?.district).toBe('臺東縣');
  });
});
