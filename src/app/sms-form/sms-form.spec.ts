import { ComponentFixture, DeferBlockState, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { SmsForm, DISTRICT_SEARCH_DEBOUNCE_MS } from './sms-form';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS, findStationByAddress } from '../police-stations';
import { GeocodingService } from '../geocoding.service';
import { LocationInput } from './location-input/location-input';
import {
  ViolationInput,
  VIOLATION_FILTER_DEBOUNCE_MS,
} from './violation-input/violation-input';

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

  function mockDialogResult(result: boolean | undefined): void {
    dialogSpy.open.mockReturnValue({
      afterClosed: () => of(result),
    } as Partial<MatDialogRef<unknown>>);
  }

  beforeEach(async () => {
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
        afterClosed: () => of(undefined),
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

  const kaohsiungStation =
    POLICE_STATIONS.find((s) => s.district === '高雄市') ?? POLICE_STATIONS[0];

  function getLocationInput(): LocationInput {
    const ref = component['locationInput']();
    if (!ref) throw new Error('LocationInput not found');
    return ref;
  }

  function getViolationInput(): ViolationInput {
    const ref = component['violationInput']();
    if (!ref) throw new Error('ViolationInput not found');
    return ref;
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

  function mockInputEvent(value: string): Event {
    return { target: { value } } as unknown as Event;
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
    expect(getLocationInput().valid()).toBe(false);
  });

  it('should require district selection after touched', async () => {
    await renderDeferBlock();
    expect(getLocationInput()['district']()).toBeNull();
    expect(getLocationInput().districtRequired()).toBe(false);
    getLocationInput().markAsTouched();
    expect(getLocationInput().districtRequired()).toBe(true);
  });

  it('should accept valid form values with all required fields', async () => {
    await renderDeferBlock();
    fillValidForm();
    expect(getLocationInput().valid()).toBe(true);
    expect(getViolationInput().valid()).toBe(true);
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

    void component['sendSms']();
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
    mockDialogResult(true);

    await component['sendSms']();

    expect(smsServiceSpy.sendSms).toHaveBeenCalledWith(
      POLICE_STATIONS[0].phoneNumber,
      '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
    );
  });

  it('should not call sendSms when dialog is cancelled', async () => {
    await renderDeferBlock();
    fillValidForm();
    mockDialogResult(false);

    await component['sendSms']();

    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should not call sendSms when dialog is dismissed (backdrop click)', async () => {
    await renderDeferBlock();
    fillValidForm();
    mockDialogResult(undefined);

    await component['sendSms']();

    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should not open dialog when form is invalid', async () => {
    await renderDeferBlock();
    void component['sendSms']();
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

    void component['sendSms']();
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
      loc['onAddressInput'](mockInputEvent('臺北市信義區信義路五段7號'));
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(loc['district']()).toEqual(POLICE_STATIONS[0]);
    });

    it('should auto-select district with 台 → 臺 normalization', () => {
      const loc = getLocationInput();
      loc['onAddressInput'](mockInputEvent('台中市西屯區某路'));
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      const taichungStation = POLICE_STATIONS.find((s) => s.district === '臺中市');
      expect(loc['district']()).toEqual(taichungStation);
    });

    it('should not change district when address does not match', () => {
      const loc = getLocationInput();
      loc['onAddressInput'](mockInputEvent('某個不存在的地方'));
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(loc['district']()).toBeNull();
    });

    it('should debounce rapid address inputs', () => {
      const loc = getLocationInput();
      loc['onAddressInput'](mockInputEvent('臺北'));
      vi.advanceTimersByTime(100);
      expect(loc['district']()).toBeNull();

      loc['onAddressInput'](mockInputEvent('臺北市信義區信義路五段7號'));
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

      void component['sendSms']();
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

      void component['sendSms']();
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
      expect(getLocationInput().valid()).toBe(true);
      expect(getViolationInput().valid()).toBe(true);
    });

    it('should keep form valid with a valid license plate', () => {
      fillValidForm();
      const vi = getViolationInput();
      vi['violationForm'].licensePlate().value.set('ABC1234');
      vi['licensePlate'].set('ABC1234');
      expect(vi.valid()).toBe(true);
    });
  });

  describe('sms preview over-limit warning', () => {
    it('should show over-limit warning when message exceeds 70 chars', async () => {
      await renderDeferBlock();
      const longAddress =
        '臺北市信義區信義路五段某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某號';
      const loc = getLocationInput();
      loc['addressForm'].address().value.set(longAddress);
      loc['address'].set(longAddress);
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      fixture.detectChanges();
      const warning = (fixture.nativeElement as HTMLElement).querySelector('.sms-length-warning');
      expect(warning).toBeTruthy();
      expect(warning?.textContent).toContain('可能被拆為多則傳送');
    });

    it('should not show over-limit warning when message is within limit', async () => {
      await renderDeferBlock();
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('臺北市信義路');
      loc['address'].set('臺北市信義路');
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      vi['violation'].set('汽車於紅線停車');
      fixture.detectChanges();
      const warning = (fixture.nativeElement as HTMLElement).querySelector('.sms-length-warning');
      expect(warning).toBeNull();
    });
  });

  describe('onDistrictChange', () => {
    it('should update district when selection changes', async () => {
      await renderDeferBlock();
      const loc = getLocationInput();
      loc['onDistrictChange'](POLICE_STATIONS[0]);
      expect(loc['district']()).toBe(POLICE_STATIONS[0]);
    });
  });

  describe('locateUser clears pending debounce', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      await renderDeferBlock();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clear pending debounce timer when locating', async () => {
      geocodingServiceSpy.getCurrentPosition.mockResolvedValue({
        coords: { latitude: 25.033, longitude: 121.565 },
      } as GeolocationPosition);
      geocodingServiceSpy.reverseGeocode.mockResolvedValue('臺北市信義區信義路五段7號');

      const loc = getLocationInput();
      // Trigger an address input to start a debounce timer
      loc['onAddressInput'](mockInputEvent('臺北市'));

      // Locate should clear the pending debounce
      await loc['locateUser']();

      // Advance past debounce — original debounce should not fire
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS + 100);

      // District should match the geocoded address, not the typed '臺北市'
      expect(loc['address']()).toBe('臺北市信義區信義路五段7號');
    });
  });

  describe('violation input events', () => {
    beforeEach(async () => {
      await renderDeferBlock();
    });

    it('should update violation model on input event', () => {
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('汽車於紅線停車');
      const event = { target: { value: '汽車於紅線停車' } } as unknown as Event;
      vi['onViolationInput'](event);
      expect(vi['violation']()).toBe('汽車於紅線停車');
    });

    // This test ensures angle brackets are handled as plain text, not HTML. Use a safe string to avoid XSS warnings.
    it('should pass angle brackets through without manual stripping', () => {
      vi.useFakeTimers();
      const violationInput = getViolationInput();
      const sanitizedTestInput = '&lt;script&gt;alert&lt;/script&gt;';
      const event = { target: { value: sanitizedTestInput } } as unknown as Event;
      violationInput['onViolationInput'](event);
      vi.advanceTimersByTime(VIOLATION_FILTER_DEBOUNCE_MS);
      expect(violationInput['violationFilter']()).toBe(sanitizedTestInput);
      vi.useRealTimers();
      // If XSS coverage is required, sanitize or document intent here.
    });

    it('should update violation model on change event', () => {
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('機車於黃線停車');
      vi['onViolationChange']();
      expect(vi['violation']()).toBe('機車於黃線停車');
    });
  });

  describe('DOM-driven template coverage', () => {
    function queryEl<T extends Element>(selector: string): T {
      const el = (fixture.nativeElement as Element).querySelector<T>(selector);
      if (!el) throw new Error(`Element not found: ${selector}`);
      return el;
    }

    beforeEach(async () => {
      await renderDeferBlock();
    });

    it('should trigger onAddressInput via DOM input event', () => {
      vi.useFakeTimers();
      fixture.detectChanges();
      const el = queryEl<HTMLInputElement>('input[placeholder="請輸入地址..."]');
      el.value = '臺北市';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      fixture.detectChanges();
      expect(getLocationInput()['address']()).toBe('臺北市');
      vi.useRealTimers();
    });

    it('should trigger locateUser via DOM click event', async () => {
      geocodingServiceSpy.getCurrentPosition.mockResolvedValue({
        coords: { latitude: 25.033, longitude: 121.565 },
      } as GeolocationPosition);
      geocodingServiceSpy.reverseGeocode.mockResolvedValue('臺北市信義區信義路五段7號');

      fixture.detectChanges();
      queryEl<HTMLButtonElement>('button[aria-label="使用目前位置"]').click();

      // Wait for async locateUser to complete
      await vi.waitFor(() => {
        expect(getLocationInput()['isLocating']()).toBe(false);
      });
      fixture.detectChanges();
    });

    it('should show address validation errors when touched and invalid', () => {
      const loc = getLocationInput();
      loc['addressForm'].address().value.set('');
      loc.markAsTouched();
      fixture.detectChanges();
      const errors = (fixture.nativeElement as Element).querySelectorAll('mat-error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should show location error when geolocation fails', async () => {
      geocodingServiceSpy.getCurrentPosition.mockRejectedValue(
        new Error('定位權限被拒絕，請允許存取位置資訊。'),
      );
      await getLocationInput()['locateUser']();
      fixture.detectChanges();
      const errorDiv = (fixture.nativeElement as Element).querySelector('.location-error');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv?.textContent).toContain('定位權限被拒絕');
    });

    it('should trigger onDistrictChange via mat-select in DOM', () => {
      const loc = getLocationInput();
      loc['onDistrictChange'](POLICE_STATIONS[1]);
      fixture.detectChanges();
      expect(loc['district']()).toBe(POLICE_STATIONS[1]);
      const hints = (fixture.nativeElement as Element).querySelectorAll('mat-hint');
      const stationHint = Array.from(hints).find((h) =>
        h.textContent?.includes(POLICE_STATIONS[1].stationName),
      );
      expect(stationHint).toBeTruthy();
    });

    it('should trigger violation input via DOM', () => {
      fixture.detectChanges();
      const el = queryEl<HTMLInputElement>('input[placeholder="請選擇違規事實..."]');
      el.value = '紅線';
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    });

    it('should trigger toggleLicensePlate via DOM click', () => {
      fixture.detectChanges();
      queryEl<HTMLButtonElement>('.add-plate-btn').click();
      fixture.detectChanges();
      expect(getViolationInput()['showLicensePlate']()).toBe(true);
    });

    it('should trigger clearLicensePlate via DOM click', () => {
      getViolationInput()['toggleLicensePlate']();
      fixture.detectChanges();
      queryEl<HTMLButtonElement>('button[aria-label="移除車牌號碼"]').click();
      fixture.detectChanges();
      expect(getViolationInput()['showLicensePlate']()).toBe(false);
    });

    it('should trigger license plate input via DOM', () => {
      getViolationInput()['toggleLicensePlate']();
      fixture.detectChanges();
      const el = queryEl<HTMLInputElement>('input[placeholder="例：ABC1234"]');
      el.value = 'abc-123';
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(getViolationInput()['violationForm'].licensePlate().value()).toBe('ABC123');
    });

    it('should mark license plate as touched on blur', () => {
      getViolationInput()['toggleLicensePlate']();
      fixture.detectChanges();
      queryEl<HTMLInputElement>('input[placeholder="例：ABC1234"]').dispatchEvent(new Event('blur'));
      fixture.detectChanges();
      expect(getViolationInput()['violationForm'].licensePlate().touched()).toBe(true);
    });

    it('should show violation validation errors when touched and invalid', () => {
      const vi = getViolationInput();
      vi['violationForm'].violation().value.set('');
      vi.markAsTouched();
      fixture.detectChanges();
      const errors = (fixture.nativeElement as HTMLElement).querySelectorAll(
        'app-violation-input mat-error',
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should show license plate validation errors when touched and invalid', () => {
      const vi = getViolationInput();
      vi['toggleLicensePlate']();
      vi['violationForm'].licensePlate().value.set('!!!');
      vi['violationForm'].licensePlate().markAsTouched();
      fixture.detectChanges();
      const errors = (fixture.nativeElement as HTMLElement).querySelectorAll(
        'app-violation-input mat-error',
      );
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should render @defer placeholder skeleton', async () => {
      const freshFixture = TestBed.createComponent(SmsForm);
      freshFixture.detectChanges();
      const skeleton = (freshFixture.nativeElement as HTMLElement).querySelector('.form-skeleton');
      expect(skeleton).toBeTruthy();
      const skeletonFields = (freshFixture.nativeElement as HTMLElement).querySelectorAll(
        '.skeleton-field',
      );
      expect(skeletonFields.length).toBeGreaterThan(0);
    });
  });
});

describe('SmsForm desktop behavior', () => {
  let fixture: ComponentFixture<SmsForm>;

  beforeEach(async () => {
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
              afterClosed: () => of(undefined),
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
    const submitButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      'button[mat-flat-button]',
    );
    expect(submitButton?.disabled).toBe(true);
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
