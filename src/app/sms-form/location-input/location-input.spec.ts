import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { LocationInput, DISTRICT_SEARCH_DEBOUNCE_MS, ADDRESS_MAX_LENGTH } from './location-input';
import { GeocodingService } from '../../geocoding.service';
import { POLICE_STATIONS, District } from '../../police-stations';

describe('LocationInput', () => {
  let fixture: ComponentFixture<LocationInput>;
  let component: LocationInput;
  let mockGeocodingService: {
    getCurrentPosition: ReturnType<typeof vi.fn>;
    reverseGeocode: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.useFakeTimers();

    mockGeocodingService = {
      getCurrentPosition: vi.fn(),
      reverseGeocode: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [LocationInput],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GeocodingService, useValue: mockGeocodingService },
      ],
    });

    fixture = TestBed.createComponent(LocationInput);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function fireAddressInput(value: string): void {
    component['onAddressInput']({ target: { value } } as unknown as Event);
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with empty address and null district', () => {
    expect(component['address']()).toBe('');
    expect(component['district']()).toBeNull();
  });

  it('should update address on input event', () => {
    fireAddressInput('測試地址');
    expect(component['address']()).toBe('測試地址');
  });

  it('should require address (validation)', () => {
    fireAddressInput('');
    component.markAsTouched();
    expect(component['addressForm'].address().valid()).toBe(false);
  });

  it('should enforce max length on address', () => {
    const longAddress = '字'.repeat(ADDRESS_MAX_LENGTH + 1);
    fireAddressInput(longAddress);
    expect(component['addressForm'].address().valid()).toBe(false);
  });

  it('should auto-select district when address contains known district', () => {
    fireAddressInput('臺北市信義區信義路');
    vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);

    const district = component['district']();
    expect(district).not.toBeNull();
    expect(district!.district).toBe(District.Taipei);
  });

  it('should set district on onDistrictChange', () => {
    const station = POLICE_STATIONS[0];
    component['onDistrictChange'](station);
    expect(component['district']()).toBe(station);
  });

  it('should detect district mismatch', () => {
    fireAddressInput('臺北市信義區信義路');
    vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);

    const kaohsiungStation = POLICE_STATIONS.find((s) => s.district === District.Kaohsiung)!;
    component['onDistrictChange'](kaohsiungStation);

    expect(component.districtMismatch()).toBe(true);
  });

  it('should not detect mismatch when no district selected', () => {
    fireAddressInput('臺北市信義區信義路');
    vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);
    // Reset district to null
    component['district'].set(null);

    expect(component.districtMismatch()).toBe(false);
  });

  it('should show valid=true when address and district are set', () => {
    fireAddressInput('臺北市信義區信義路');
    vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);

    expect(component['district']()).not.toBeNull();
    expect(component.valid()).toBe(true);
  });

  it('should show valid=false when district is null', () => {
    fireAddressInput('某個不含行政區的地址');
    vi.advanceTimersByTime(DISTRICT_SEARCH_DEBOUNCE_MS);

    expect(component['district']()).toBeNull();
    expect(component.valid()).toBe(false);
  });

  it('should show districtRequired after markAsTouched with null district', async () => {
    expect(component.districtRequired()).toBe(false);

    component.markAsTouched();
    await vi.advanceTimersByTimeAsync(0);

    expect(component.districtRequired()).toBe(true);
  });

  it('should not show districtRequired before touch', () => {
    expect(component.districtRequired()).toBe(false);
  });

  it('should locate user successfully', async () => {
    mockGeocodingService.getCurrentPosition.mockResolvedValue({
      coords: { latitude: 25.033, longitude: 121.565 },
    });
    mockGeocodingService.reverseGeocode.mockResolvedValue('臺北市信義區信義路五段7號');

    await component['locateUser']();

    expect(component['address']()).toBe('臺北市信義區信義路五段7號');
    expect(component['district']()).not.toBeNull();
    expect(component['district']()!.district).toBe(District.Taipei);
    expect(component['isLocating']()).toBe(false);
  });

  it('should handle location error', async () => {
    mockGeocodingService.getCurrentPosition.mockRejectedValue(new Error('定位權限被拒絕'));

    await component['locateUser']();

    expect(component['locationError']()).toBe('定位權限被拒絕');
    expect(component['isLocating']()).toBe(false);
  });

  it('should prevent concurrent locateUser calls', async () => {
    let resolvePosition: (value: unknown) => void;
    const positionPromise = new Promise((resolve) => {
      resolvePosition = resolve;
    });
    mockGeocodingService.getCurrentPosition.mockReturnValue(positionPromise);
    mockGeocodingService.reverseGeocode.mockResolvedValue('臺北市信義區信義路五段7號');

    const firstCall = component['locateUser']();
    // Second call should be blocked by isLocating guard
    const secondCall = component['locateUser']();

    expect(mockGeocodingService.getCurrentPosition).toHaveBeenCalledTimes(1);

    resolvePosition!({ coords: { latitude: 25.033, longitude: 121.565 } });
    await firstCall;
    await secondCall;
  });
});
