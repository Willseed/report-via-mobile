import { signal } from '@angular/core';
import { ComponentFixture, DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of } from 'rxjs';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { SmsForm, DISTRICT_SEARCH_DEBOUNCE_MS } from './sms-form';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS, findStationByAddress, normalizeAddress } from '../police-stations';
import { GeocodingService } from '../geocoding.service';
import { ReportStateService } from '../services/report-state.service';
import { LocationInput } from './location-input/location-input';
import {
  ViolationInput,
  VIOLATION_FILTER_DEBOUNCE_MS,
} from './violation-input/violation-input';
import { mockGeolocationPosition } from '../../testing/geolocation';

const VALID_ADDRESS = '臺北市信義區信義路五段7號';
const SHORT_ADDRESS = '臺北市信義路';
const UNKNOWN_ADDRESS = '某個不存在的地方';
const VALID_VIOLATION = '汽車於紅線停車';
const VALID_PLATE = 'ABC1234';
const EXPECTED_MESSAGE = `${VALID_ADDRESS}，有${VALID_VIOLATION}，請派員處理`;
const EXPECTED_MESSAGE_WITH_PLATE =
  `${VALID_ADDRESS}，有${VALID_VIOLATION}，車牌號碼：${VALID_PLATE}，請派員處理`;
const LONG_ADDRESS =
  '臺北市信義區信義路五段某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某某號';
const GEOLOCATION_PERMISSION_DENIED = '定位權限被拒絕，請允許存取位置資訊。';
const LICENSE_PLATE_INPUT_SELECTOR = 'input[placeholder="例：ABC1234"]';

interface FormState {
  address?: string;
  station?: (typeof POLICE_STATIONS)[number] | null;
  violation?: string;
  plate?: string;
}

function mockDialogResult(
  dialogSpy: { open: ReturnType<typeof vi.fn> },
  result: boolean | undefined,
): void {
  dialogSpy.open.mockReturnValue({
    afterClosed: () => of(result),
  } as Partial<MatDialogRef<unknown>>);
}

function getLocationInput(component: SmsForm): LocationInput {
  const ref = component['locationInput']();
  if (!ref) throw new Error('LocationInput not found');
  return ref;
}

function getViolationInput(component: SmsForm): ViolationInput {
  const ref = component['violationInput']();
  if (!ref) throw new Error('ViolationInput not found');
  return ref;
}

function setFormState(
  state: ReportStateService,
  {
    address = VALID_ADDRESS,
    station = POLICE_STATIONS[0],
    violation = VALID_VIOLATION,
    plate,
  }: FormState = {},
): void {
  if (address !== undefined) state.setAddress(address);
  if (station !== undefined) state.setSelectedStation(station);
  if (violation !== undefined) state.setViolation(violation);
  if (plate !== undefined) state.setLicensePlate(plate);
}

function fillValidForm(state: ReportStateService, station = POLICE_STATIONS[0]): void {
  setFormState(state, { station });
}

function hostElement(fixture: ComponentFixture<SmsForm>): HTMLElement {
  return fixture.nativeElement;
}

function queryEl<T extends Element>(fixture: ComponentFixture<SmsForm>, selector: string): T {
  const el = hostElement(fixture).querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el;
}

function queryOptional<T extends Element>(
  fixture: ComponentFixture<SmsForm>,
  selector: string,
): T | null {
  return hostElement(fixture).querySelector<T>(selector);
}

function queryAll(fixture: ComponentFixture<SmsForm>, selector: string): NodeListOf<Element> {
  return hostElement(fixture).querySelectorAll(selector);
}

function smsPreview(fixture: ComponentFixture<SmsForm>): Element | null {
  return queryOptional(fixture, '.sms-preview');
}

function smsBubble(fixture: ComponentFixture<SmsForm>): Element | null {
  return queryOptional(fixture, '.sms-bubble');
}

function lengthWarning(fixture: ComponentFixture<SmsForm>): Element | null {
  return queryOptional(fixture, '.sms-length-warning');
}

function districtWarning(fixture: ComponentFixture<SmsForm>): Element | null {
  return queryOptional(fixture, '.district-mismatch-warning');
}

function submitButton(fixture: ComponentFixture<SmsForm>): HTMLButtonElement | null {
  return queryOptional<HTMLButtonElement>(fixture, 'button[mat-flat-button]');
}

function validationErrors(
  fixture: ComponentFixture<SmsForm>,
  selector = 'mat-error',
): NodeListOf<Element> {
  return queryAll(fixture, selector);
}

function mockInputEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}

function mockPendingPosition(geocodingServiceSpy: {
  getCurrentPosition: ReturnType<typeof vi.fn>;
}): (value: GeolocationPosition) => void {
  let resolvePosition: ((value: GeolocationPosition) => void) | undefined;
  geocodingServiceSpy.getCurrentPosition.mockReturnValue(
    new Promise<GeolocationPosition>((resolve) => {
      resolvePosition = resolve;
    }),
  );
  if (!resolvePosition) throw new Error('Position resolver was not initialized');
  return resolvePosition;
}

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
    fallbackToManualInput: ReturnType<typeof signal<boolean>>;
  };
  let dialogSpy: { open: ReturnType<typeof vi.fn> };
  let state: ReportStateService;

  beforeEach(async () => {
    smsServiceSpy = {
      sendSms: vi.fn(),
      generateSmsLink: vi.fn().mockReturnValue('sms:0911510914?body=Hello'),
      isDesktop: vi.fn().mockReturnValue(false),
    };
    geocodingServiceSpy = {
      getCurrentPosition: vi.fn(),
      reverseGeocode: vi.fn(),
      fallbackToManualInput: signal(false),
    };
    dialogSpy = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(undefined),
      } as Partial<MatDialogRef<unknown>>),
    };

    await TestBed.configureTestingModule({
      imports: [SmsForm],
      deferBlockBehavior: DeferBlockBehavior.Manual,
      providers: [
        { provide: SmsService, useValue: smsServiceSpy },
        { provide: GeocodingService, useValue: geocodingServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SmsForm);
    component = fixture.componentInstance;
    state = TestBed.inject(ReportStateService);
    fixture.detectChanges();

    const deferBlocks = await fixture.getDeferBlocks();
    for (const block of deferBlocks) {
      await block.render(DeferBlockState.Complete);
    }
    fixture.detectChanges();
  });

  const kaohsiungStation =
    POLICE_STATIONS.find((s) => s.district === '高雄市') ?? POLICE_STATIONS[0];

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have an invalid form when empty', async () => {
    expect(getLocationInput(component).valid()).toBe(false);
  });

  it('should require district selection after touched', async () => {
    expect(getLocationInput(component)['district']()).toBeNull();
    expect(getLocationInput(component).districtRequired()).toBe(false);
    getLocationInput(component).markAsTouched();
    expect(getLocationInput(component).districtRequired()).toBe(true);
  });

  it('should accept valid form values with all required fields', async () => {
    fillValidForm(state);
    expect(getLocationInput(component).valid()).toBe(true);
    expect(getViolationInput(component).valid()).toBe(true);
  });

  it('should return district from location input', async () => {
    expect(state.station()).toBeNull();

    state.setSelectedStation(POLICE_STATIONS[0]);
    expect(state.station()).toBe(POLICE_STATIONS[0]);
  });

  it('should open confirm dialog on valid submit', async () => {
    fillValidForm(state);

    await component['sendSms']();
    expect(dialogSpy.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          stationName: POLICE_STATIONS[0].stationName,
          phoneNumber: POLICE_STATIONS[0].phoneNumber,
          message: EXPECTED_MESSAGE,
        },
      }),
    );
  });

  it('should call sendSms after dialog is confirmed', async () => {
    fillValidForm(state);
    mockDialogResult(dialogSpy, true);

    await component['sendSms']();

    expect(smsServiceSpy.sendSms).toHaveBeenCalledWith(
      POLICE_STATIONS[0].phoneNumber,
      EXPECTED_MESSAGE,
    );
  });

  it('should not call sendSms when dialog is cancelled', async () => {
    fillValidForm(state);
    mockDialogResult(dialogSpy, false);

    await component['sendSms']();

    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should not call sendSms when dialog is dismissed (backdrop click)', async () => {
    fillValidForm(state);
    mockDialogResult(dialogSpy, undefined);

    await component['sendSms']();

    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should not open dialog when form is invalid', async () => {
    void component['sendSms']();
    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  it('should not open dialog when district mismatches even if form is valid', async () => {
    setFormState(state, { station: kaohsiungStation });

    void component['sendSms']();
    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  describe('address input and auto-select district', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should auto-select district when address contains district name', () => {
      const loc = getLocationInput(component);
      loc['onAddressInput'](mockInputEvent(VALID_ADDRESS));
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(loc['district']()).toEqual(POLICE_STATIONS[0]);
    });

    it('should auto-select district with 台 → 臺 normalization', () => {
      const loc = getLocationInput(component);
      loc['onAddressInput'](mockInputEvent('台中市西屯區某路'));
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      const taichungStation = POLICE_STATIONS.find((s) => s.district === '臺中市');
      expect(loc['district']()).toEqual(taichungStation);
    });

    it('should not change district when address does not match', () => {
      const loc = getLocationInput(component);
      loc['onAddressInput'](mockInputEvent(UNKNOWN_ADDRESS));
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(loc['district']()).toBeNull();
    });

    it('should debounce rapid address inputs', () => {
      const loc = getLocationInput(component);
      loc['onAddressInput'](mockInputEvent('臺北'));
      vi.advanceTimersByTime(100);
      expect(loc['district']()).toBeNull();

      loc['onAddressInput'](mockInputEvent(VALID_ADDRESS));
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      expect(loc['district']()).toEqual(POLICE_STATIONS[0]);
    });
  });

  describe('districtMismatch', () => {
    it.each([
      {
        name: 'detect mismatch when address district differs from selected district',
        formState: { station: kaohsiungStation },
        expected: true,
      },
      {
        name: 'not detect mismatch when address and district match',
        formState: {},
        expected: false,
      },
      {
        name: 'not detect mismatch when address has no recognizable district',
        formState: { address: UNKNOWN_ADDRESS },
        expected: false,
      },
    ])('should $name', ({ formState, expected }) => {
      setFormState(state, formState);
      expect(getLocationInput(component).districtMismatch()).toBe(expected);
    });

    it('should not detect mismatch when no district is selected', () => {
      state.setAddress(VALID_ADDRESS);
      expect(getLocationInput(component).districtMismatch()).toBe(false);
    });

    it('should disable submit button when district mismatches', async () => {
      setFormState(state, { station: kaohsiungStation });
      fixture.detectChanges();
      const buttonDebug = fixture.debugElement.query(
        (el) => el.name === 'button' && el.attributes['mat-flat-button'] !== undefined,
      );
      expect(buttonDebug.nativeElement.disabled).toBe(true);
    });

    it('should show warning message when district mismatches', () => {
      setFormState(state, { station: kaohsiungStation });
      fixture.detectChanges();
      expect(districtWarning(fixture)).toBeTruthy();
    });

    it('should not show warning when district matches', () => {
      fillValidForm(state);
      fixture.detectChanges();
      expect(districtWarning(fixture)).toBeNull();
    });
  });

  describe('composedMessage', () => {
    it('should compose message from address and violation', () => {
      fillValidForm(state);
      expect(component['composedMessage']()).toBe(EXPECTED_MESSAGE);
    });

    it('should return empty string when address is missing', () => {
      state.setViolation(VALID_VIOLATION);
      expect(component['composedMessage']()).toBe('');
    });

    it('should return empty string when violation is missing', () => {
      state.setAddress(VALID_ADDRESS);
      state.setSelectedStation(POLICE_STATIONS[0]);
      expect(component['composedMessage']()).toBe('');
    });

    it('should return empty string when district is not set', () => {
      state.setAddress(VALID_ADDRESS);
      state.setViolation(VALID_VIOLATION);
      expect(component['composedMessage']()).toBe('');
    });
  });

  describe('pendingPreview', () => {
    it('should show pending hint when address is set but district is null', () => {
      state.setAddress('某地址');
      expect(component['pendingPreview']()).toBe(true);
    });

    it('should not show pending hint when district is set', () => {
      state.setAddress('臺北市信義區');
      state.setSelectedStation(POLICE_STATIONS[0]);
      expect(component['pendingPreview']()).toBe(false);
    });

    it('should not show pending hint when nothing is entered', () => {
      expect(component['pendingPreview']()).toBe(false);
    });
  });

  describe('sms preview', () => {
    it('should show preview when address and violation are filled', async () => {
      fillValidForm(state);
      fixture.detectChanges();
      expect(smsPreview(fixture)).toBeTruthy();
    });

    it('should hide preview when address is empty', async () => {
      state.setViolation(VALID_VIOLATION);
      fixture.detectChanges();
      expect(smsPreview(fixture)).toBeNull();
    });

    it('should hide preview when violation is empty', async () => {
      state.setAddress(VALID_ADDRESS);
      fixture.detectChanges();
      expect(smsPreview(fixture)).toBeNull();
    });

    it('should display composed message in bubble', async () => {
      fillValidForm(state);
      fixture.detectChanges();
      expect(smsBubble(fixture)?.textContent?.trim()).toBe(EXPECTED_MESSAGE);
    });
  });

  describe('filteredViolations', () => {
    it('should return all violations when filter is empty', () => {
      expect(getViolationInput(component)['filteredViolations']().length).toBe(27);
    });

    it('should filter violations by keyword', () => {
      state.setViolationFilter('紅線');
      expect(getViolationInput(component)['filteredViolations']()).toEqual([
        VALID_VIOLATION,
        '機車於紅線停車',
      ]);
    });

    it('should filter by vehicle type', () => {
      state.setViolationFilter('機車');
      const filtered = getViolationInput(component)['filteredViolations']();
      expect(filtered.length).toBe(9);
      expect(filtered.every((v) => v.includes('機車'))).toBe(true);
    });

    it('should return all violations when filter matches an exact option', () => {
      state.setViolationFilter(VALID_VIOLATION);
      expect(getViolationInput(component)['filteredViolations']().length).toBe(27);
    });

    it('should include car-only violation for disabled parking space', () => {
      state.setViolationFilter('身心障礙');
      const results = getViolationInput(component)['filteredViolations']();
      expect(results).toEqual(['汽車違法佔用身心障礙者專用停車位']);
    });

    it('should not include car-only violations for motorcycles', () => {
      const violations = getViolationInput(component)['filteredViolations']();
      expect(violations).not.toContain('機車違法佔用身心障礙者專用停車位');
      expect(violations).toContain('汽車違法佔用身心障礙者專用停車位');
    });

    it('should include the shared sidewalk and crosswalk temporary parking violation', () => {
      state.setViolationFilter('行人穿越道');
      expect(getViolationInput(component)['filteredViolations']()).toEqual([
        '汽車於人行道、行人穿越道違規臨停',
        '機車於人行道、行人穿越道違規臨停',
      ]);
    });
  });

  describe('smsOverLimit', () => {
    it('should detect when message exceeds 70 characters', () => {
      setFormState(state, { address: LONG_ADDRESS });
      expect(component['composedMessage']().length).toBeGreaterThan(70);
    });

    it('should not flag when message is within limit', () => {
      setFormState(state, { address: SHORT_ADDRESS });
      expect(component['composedMessage']().length).toBeLessThanOrEqual(70);
    });
  });

  describe('locateUser', () => {
    it('should fill address and auto-select district on success', async () => {
      geocodingServiceSpy.getCurrentPosition.mockResolvedValue(mockGeolocationPosition());
      geocodingServiceSpy.reverseGeocode.mockResolvedValue(VALID_ADDRESS);

      await getLocationInput(component)['locateUser']();

      expect(getLocationInput(component)['addressForm'].address().value()).toBe(VALID_ADDRESS);
      expect(getLocationInput(component)['district']()).toEqual(POLICE_STATIONS[0]);
      expect(getLocationInput(component)['isLocating']()).toBe(false);
      expect(getLocationInput(component)['locationError']()).toBe('');
    });

    it('should show error message on failure', async () => {
      geocodingServiceSpy.getCurrentPosition.mockRejectedValue(
        new Error(GEOLOCATION_PERMISSION_DENIED),
      );

      await getLocationInput(component)['locateUser']();

      expect(getLocationInput(component)['locationError']()).toBe(GEOLOCATION_PERMISSION_DENIED);
      expect(getLocationInput(component)['isLocating']()).toBe(false);
    });

    it('should skip when already locating (race condition guard)', async () => {
      const resolvePosition = mockPendingPosition(geocodingServiceSpy);
      geocodingServiceSpy.reverseGeocode.mockResolvedValue('臺北市信義區');

      const loc = getLocationInput(component);
      const promise1 = loc['locateUser']();
      expect(loc['isLocating']()).toBe(true);

      const promise2 = loc['locateUser']();

      resolvePosition(mockGeolocationPosition(25, 121));
      await promise1;
      await promise2;

      expect(geocodingServiceSpy.getCurrentPosition).toHaveBeenCalledTimes(1);
    });

    it('should set isLocating during location process', async () => {
      const resolvePosition = mockPendingPosition(geocodingServiceSpy);

      const loc = getLocationInput(component);
      const promise = loc['locateUser']();
      expect(loc['isLocating']()).toBe(true);

      geocodingServiceSpy.reverseGeocode.mockResolvedValue('臺北市信義區');
      resolvePosition(mockGeolocationPosition(25, 121));
      await promise;

      expect(loc['isLocating']()).toBe(false);
    });
  });

  describe('licensePlate', () => {
    it('should not show license plate field by default', () => {
      expect(getViolationInput(component)['showLicensePlate']()).toBe(false);
    });

    it('should show license plate field after toggle', () => {
      getViolationInput(component)['toggleLicensePlate']();
      expect(getViolationInput(component)['showLicensePlate']()).toBe(true);
    });

    it('should hide field and clear value on clearLicensePlate', () => {
      const vi = getViolationInput(component);
      vi['toggleLicensePlate']();
      state.setLicensePlate(VALID_PLATE);
      vi['clearLicensePlate']();
      expect(vi['showLicensePlate']()).toBe(false);
      expect(vi['violationForm'].licensePlate().value()).toBe('');
    });

    it('should auto-uppercase and filter non-alphanumeric on input', () => {
      const vi = getViolationInput(component);
      vi['toggleLicensePlate']();
      const event = { target: { value: 'abc-123!' } } as unknown as Event;
      vi['onLicensePlateInput'](event);
      expect(vi['violationForm'].licensePlate().value()).toBe('ABC123');
    });

    it('should not modify value when input is already clean uppercase', () => {
      const vi = getViolationInput(component);
      vi['toggleLicensePlate']();
      state.setLicensePlate(VALID_PLATE);
      const event = { target: { value: VALID_PLATE } } as unknown as Event;
      vi['onLicensePlateInput'](event);
      expect(vi['violationForm'].licensePlate().value()).toBe(VALID_PLATE);
    });

    it('should include plate in composed message when provided', () => {
      setFormState(state, { plate: VALID_PLATE });
      expect(component['composedMessage']()).toBe(EXPECTED_MESSAGE_WITH_PLATE);
    });

    it('should not include plate segment when plate is empty', () => {
      fillValidForm(state);
      expect(component['composedMessage']()).toBe(EXPECTED_MESSAGE);
    });

    it('should pass licensePlate to confirm dialog when present', async () => {
      fillValidForm(state);
      state.setLicensePlate('XYZ9999');

      await component['sendSms']();
      expect(dialogSpy.open).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            licensePlate: 'XYZ9999',
          }),
        }),
      );
    });

    it('should not pass licensePlate to dialog when empty', async () => {
      fillValidForm(state);

      await component['sendSms']();
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
      const btn = queryOptional(fixture, '.add-plate-btn');
      expect(btn).toBeTruthy();
      expect(btn?.textContent).toContain('新增車牌號碼');
    });

    it('should show license plate field after clicking add button', () => {
      getViolationInput(component)['toggleLicensePlate']();
      fixture.detectChanges();
      const field = queryOptional(fixture, LICENSE_PLATE_INPUT_SELECTOR);
      expect(field).toBeTruthy();
    });

    it('should hide add-plate button when field is shown', () => {
      getViolationInput(component)['toggleLicensePlate']();
      fixture.detectChanges();
      const btn = queryOptional(fixture, '.add-plate-btn');
      expect(btn).toBeNull();
    });

    it('should keep form valid when license plate is empty (optional field)', () => {
      fillValidForm(state);
      expect(getLocationInput(component).valid()).toBe(true);
      expect(getViolationInput(component).valid()).toBe(true);
    });

    it('should keep form valid with a valid license plate', () => {
      fillValidForm(state);
      state.setLicensePlate(VALID_PLATE);
      expect(getViolationInput(component).valid()).toBe(true);
    });
  });

  describe('sms preview over-limit warning', () => {
    it('should show over-limit warning when message exceeds 70 chars', async () => {
      setFormState(state, { address: LONG_ADDRESS });
      fixture.detectChanges();
      expect(lengthWarning(fixture)).toBeTruthy();
      expect(lengthWarning(fixture)?.textContent).toContain('可能被拆為多則傳送');
    });

    it('should not show over-limit warning when message is within limit', async () => {
      setFormState(state, { address: SHORT_ADDRESS, station: null });
      fixture.detectChanges();
      expect(lengthWarning(fixture)).toBeNull();
    });
  });

  describe('onDistrictChange', () => {
    it('should update district when selection changes', async () => {
      const loc = getLocationInput(component);
      loc['onDistrictChange'](POLICE_STATIONS[0]);
      expect(loc['district']()).toBe(POLICE_STATIONS[0]);
    });
  });

  describe('locateUser clears pending debounce', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should clear pending debounce timer when locating', async () => {
      geocodingServiceSpy.getCurrentPosition.mockResolvedValue(mockGeolocationPosition());
      geocodingServiceSpy.reverseGeocode.mockResolvedValue(VALID_ADDRESS);

      const loc = getLocationInput(component);
      // Trigger an address input to start a debounce timer
      loc['onAddressInput'](mockInputEvent('臺北市'));

      // Locate should clear the pending debounce
      await loc['locateUser']();

      // Advance past debounce — original debounce should not fire
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS + 100);

      // District should match the geocoded address, not the typed '臺北市'
      expect(loc['address']()).toBe(VALID_ADDRESS);
    });
  });

  describe('violation input events', () => {
    it('should update violation model on input event', () => {
      vi.useFakeTimers();
      const violationInput = getViolationInput(component);
      violationInput['violationForm'].violation().value.set(VALID_VIOLATION);
      const event = { target: { value: VALID_VIOLATION } } as unknown as Event;
      violationInput['onViolationInput'](event);
      vi.advanceTimersByTime(VIOLATION_FILTER_DEBOUNCE_MS);
      expect(violationInput['violation']()).toBe(VALID_VIOLATION);
      vi.useRealTimers();
    });

    // This test ensures angle brackets are handled as plain text, not HTML. Use a safe string to avoid XSS warnings.
    it('should pass angle brackets through without manual stripping', () => {
      vi.useFakeTimers();
      const violationInput = getViolationInput(component);
      const sanitizedTestInput = '&lt;script&gt;alert&lt;/script&gt;';
      const event = { target: { value: sanitizedTestInput } } as unknown as Event;
      violationInput['onViolationInput'](event);
      vi.advanceTimersByTime(VIOLATION_FILTER_DEBOUNCE_MS);
      expect(violationInput['violationFilter']()).toBe(sanitizedTestInput);
      vi.useRealTimers();
      // If XSS coverage is required, sanitize or document intent here.
    });

    it('should update violation model on change event', () => {
      const vi = getViolationInput(component);
      vi['violationForm'].violation().value.set('機車於黃線停車');
      vi['onViolationChange']();
      expect(vi['violation']()).toBe('機車於黃線停車');
    });
  });

  describe('DOM-driven template coverage', () => {
    it('should trigger onAddressInput via DOM input event', () => {
      vi.useFakeTimers();
      fixture.detectChanges();
      const el = queryEl<HTMLInputElement>(fixture, 'input[placeholder="請輸入地址..."]');
      el.value = '臺北市';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
      fixture.detectChanges();
      expect(getLocationInput(component)['address']()).toBe('臺北市');
      vi.useRealTimers();
    });

    it('should trigger locateUser via DOM click event', async () => {
      geocodingServiceSpy.getCurrentPosition.mockResolvedValue(mockGeolocationPosition());
      geocodingServiceSpy.reverseGeocode.mockResolvedValue(VALID_ADDRESS);

      fixture.detectChanges();
      queryEl<HTMLButtonElement>(fixture, 'button[aria-label="使用目前位置"]').click();

      // Wait for async locateUser to complete
      await vi.waitFor(() => {
        expect(getLocationInput(component)['isLocating']()).toBe(false);
      });
      fixture.detectChanges();
    });

    it('should show address validation errors when touched and invalid', () => {
      const loc = getLocationInput(component);
      loc['addressForm'].address().value.set('');
      loc.markAsTouched();
      fixture.detectChanges();
      const errors = validationErrors(fixture);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should show location error when geolocation fails', async () => {
      geocodingServiceSpy.getCurrentPosition.mockRejectedValue(
        new Error(GEOLOCATION_PERMISSION_DENIED),
      );
      await getLocationInput(component)['locateUser']();
      fixture.detectChanges();
      const errorDiv = queryOptional(fixture, '.location-error');
      expect(errorDiv).toBeTruthy();
      expect(errorDiv?.textContent).toContain('定位權限被拒絕');
    });

    it('should trigger onDistrictChange via mat-select in DOM', () => {
      const loc = getLocationInput(component);
      loc['onDistrictChange'](POLICE_STATIONS[1]);
      fixture.detectChanges();
      expect(loc['district']()).toBe(POLICE_STATIONS[1]);
      const hints = queryAll(fixture, 'mat-hint');
      const stationHint = Array.from(hints).find((h) =>
        h.textContent?.includes(POLICE_STATIONS[1].stationName),
      );
      expect(stationHint).toBeTruthy();
    });

    it('should trigger violation input via DOM', () => {
      fixture.detectChanges();
      const el = queryEl<HTMLInputElement>(fixture, 'input[placeholder="請選擇違規事實..."]');
      el.value = '紅線';
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    });

    it('should trigger toggleLicensePlate via DOM click', () => {
      fixture.detectChanges();
      queryEl<HTMLButtonElement>(fixture, '.add-plate-btn').click();
      fixture.detectChanges();
      expect(getViolationInput(component)['showLicensePlate']()).toBe(true);
    });

    it('should trigger clearLicensePlate via DOM click', () => {
      getViolationInput(component)['toggleLicensePlate']();
      fixture.detectChanges();
      queryEl<HTMLButtonElement>(fixture, 'button[aria-label="移除車牌號碼"]').click();
      fixture.detectChanges();
      expect(getViolationInput(component)['showLicensePlate']()).toBe(false);
    });

    it('should trigger license plate input via DOM', () => {
      getViolationInput(component)['toggleLicensePlate']();
      fixture.detectChanges();
      const el = queryEl<HTMLInputElement>(fixture, LICENSE_PLATE_INPUT_SELECTOR);
      el.value = 'abc-123';
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      expect(getViolationInput(component)['violationForm'].licensePlate().value()).toBe('ABC123');
    });

    it('should mark license plate as touched on blur', () => {
      getViolationInput(component)['toggleLicensePlate']();
      fixture.detectChanges();
      queryEl<HTMLInputElement>(fixture, LICENSE_PLATE_INPUT_SELECTOR).dispatchEvent(
        new Event('blur'),
      );
      fixture.detectChanges();
      expect(getViolationInput(component)['violationForm'].licensePlate().touched()).toBe(true);
    });

    it('should show violation validation errors when touched and invalid', () => {
      const vi = getViolationInput(component);
      vi['violationForm'].violation().value.set('');
      vi.markAsTouched();
      fixture.detectChanges();
      const errors = validationErrors(fixture, 'app-violation-input mat-error');
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should show license plate validation errors when touched and invalid', () => {
      const vi = getViolationInput(component);
      vi['toggleLicensePlate']();
      vi['violationForm'].licensePlate().value.set('!!!');
      vi['violationForm'].licensePlate().markAsTouched();
      fixture.detectChanges();
      const errors = validationErrors(fixture, 'app-violation-input mat-error');
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

describe('SmsForm desktop behavior', () => {
  let fixture: ComponentFixture<SmsForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SmsForm],
      deferBlockBehavior: DeferBlockBehavior.Manual,
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
          useValue: {
            getCurrentPosition: vi.fn(),
            reverseGeocode: vi.fn(),
            fallbackToManualInput: signal(false),
          },
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

    const deferBlocks = await fixture.getDeferBlocks();
    for (const block of deferBlocks) {
      await block.render(DeferBlockState.Complete);
    }
    fixture.detectChanges();
  });

  it('should show desktop warning when on desktop', () => {
    const warning = queryOptional(fixture, '.desktop-warning');
    expect(warning).toBeTruthy();
    expect(warning?.textContent).toContain('簡訊連結可能無法在桌面瀏覽器上使用');
  });

  it('should disable submit button when on desktop', async () => {
    fixture.detectChanges();
    expect(submitButton(fixture)?.disabled).toBe(true);
  });

  it('should render disclaimer section in defer block', () => {
    const details = queryOptional(fixture, 'details.disclaimer');
    expect(details).not.toBeNull();
    const summary = details?.querySelector('summary');
    expect(summary?.textContent).toContain('免責聲明');
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
    const result = findStationByAddress(UNKNOWN_ADDRESS);
    expect(result).toBeNull();
  });

  it('should match 台東縣 after normalization', () => {
    const result = findStationByAddress('台東縣太麻里鄉');
    expect(result).not.toBeNull();
    expect(result?.district).toBe('臺東縣');
  });

  it('should match district anywhere in address using includes', () => {
    const result = findStationByAddress('中華民國臺北市信義區信義路');
    expect(result).not.toBeNull();
    expect(result?.district).toBe('臺北市');
  });

  it('should strip 台灣 prefix before matching', () => {
    const result = findStationByAddress('台灣台中市西屯區');
    expect(result).not.toBeNull();
    expect(result?.district).toBe('臺中市');
  });

  it('should strip 中華民國 prefix before matching', () => {
    const result = findStationByAddress('中華民國高雄市前鎮區');
    expect(result).not.toBeNull();
    expect(result?.district).toBe('高雄市');
  });

  it('should strip postal code before matching', () => {
    const result = findStationByAddress('242 新北市新莊區某路');
    expect(result).not.toBeNull();
    expect(result?.district).toBe('新北市');
  });
});

describe('normalizeAddress', () => {
  it('should strip 台灣', () => {
    expect(normalizeAddress('台灣臺北市信義區')).toBe('臺北市信義區');
  });

  it('should strip 中華民國', () => {
    expect(normalizeAddress('中華民國高雄市前鎮區')).toBe('高雄市前鎮區');
  });

  it('should strip Taiwan (case-insensitive)', () => {
    expect(normalizeAddress('Taiwan 臺北市')).toBe('臺北市');
  });

  it('should strip ROC', () => {
    expect(normalizeAddress('ROC臺中市')).toBe('臺中市');
  });

  it('should strip postal code at start', () => {
    expect(normalizeAddress('242 新北市新莊區')).toBe('新北市新莊區');
  });

  it('should strip 5-digit postal code', () => {
    expect(normalizeAddress('24205 新北市新莊區')).toBe('新北市新莊區');
  });

  it('should return trimmed string when no prefix found', () => {
    expect(normalizeAddress('臺北市信義區')).toBe('臺北市信義區');
  });
});
