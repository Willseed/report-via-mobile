import { Injectable, computed, inject, signal } from '@angular/core';
import { form, maxLength, pattern, required } from '@angular/forms/signals';
import { DEFAULT_GEOLOCATION_ERROR_MSG, GeocodingService } from '../geocoding.service';
import { StationLookupService } from '../police-stations';
import { ZH_TW } from '../i18n';
import {
  ADDRESS_MAX_LENGTH,
  areStationsEqual,
  normalizeAddress,
} from '../domain/address.utils';
import { POLICE_STATIONS, type PoliceStation } from '../domain/police-stations';
import {
  cleanLicensePlate,
  filterViolations,
  LICENSE_PLATE_MAX_LENGTH,
  LICENSE_PLATE_PATTERN,
  VIOLATION_MAX_LENGTH,
  VIOLATION_TYPES,
} from '../domain/violation.utils';

@Injectable({ providedIn: 'root' })
export class ReportStateService {
  private geocodingService = inject(GeocodingService);
  private stationLookup = inject(StationLookupService);

  private addressDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private violationDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private addressState = signal('');
  private violationState = signal('');
  private licensePlateState = signal('');
  private selectedStationState = signal<PoliceStation | null>(null);
  private districtTouched = signal(false);
  private showLicensePlateState = signal(false);
  private violationFilterState = signal('');

  private isLocatingState = signal(false);
  private locationErrorState = signal('');
  private locationStatusState = signal('');

  private addressModel = signal({ address: '' });
  readonly addressForm = form(this.addressModel, (schema) => {
    required(schema.address, { message: ZH_TW.location.addressRequired });
    maxLength(schema.address, ADDRESS_MAX_LENGTH, { message: ZH_TW.location.addressMaxLength });
  });

  private violationModel = signal({ violation: '', licensePlate: '' });
  readonly violationForm = form(this.violationModel, (schema) => {
    required(schema.violation, { message: ZH_TW.violation.required });
    maxLength(schema.violation, VIOLATION_MAX_LENGTH, { message: ZH_TW.violation.maxLength });
    maxLength(schema.licensePlate, LICENSE_PLATE_MAX_LENGTH, {
      message: ZH_TW.violation.licensePlateMaxLength,
    });
    pattern(schema.licensePlate, LICENSE_PLATE_PATTERN, {
      message: ZH_TW.violation.licensePlatePattern,
    });
  });

  readonly address = this.addressState.asReadonly();
  readonly violation = this.violationState.asReadonly();
  readonly licensePlate = this.licensePlateState.asReadonly();
  readonly station = computed(() => this.selectedStationState());
  readonly district = computed(() => this.selectedStationState()?.district ?? null);
  readonly showLicensePlate = this.showLicensePlateState.asReadonly();
  readonly violationFilter = this.violationFilterState.asReadonly();
  readonly isLocating = this.isLocatingState.asReadonly();
  readonly locationError = this.locationErrorState.asReadonly();
  readonly locationStatus = this.locationStatusState.asReadonly();
  readonly manualInputFallback = computed(
    () => this.geocodingService.fallbackToManualInput?.() ?? false,
  );

  readonly stations = POLICE_STATIONS;
  readonly violationTypes = VIOLATION_TYPES;

  readonly stationFromAddress = computed(() =>
    this.stationLookup.findStation(this.addressState()),
  );
  readonly districtMismatch = computed(() => {
    const selected = this.selectedStationState();
    const matched = this.stationFromAddress();
    if (!selected || !matched) return false;
    return selected.district !== matched.district;
  });

  readonly pendingPreview = computed(() => {
    const address = this.addressState();
    const violation = this.violationState();
    const station = this.selectedStationState();
    return (!!address || !!violation) && !station;
  });

  readonly composedMessage = computed(() => {
    const address = this.addressState();
    const violation = this.violationState();
    const station = this.selectedStationState();
    if (!address || !violation || !station) return '';
    const plateSegment = this.licensePlateState()
      ? `${ZH_TW.smsMessage.platePrefix}${this.licensePlateState()}`
      : '';
    return `${address}，有${violation}${plateSegment}，請派員處理`;
  });

  readonly locationValid = computed(
    () => this.addressForm().valid() && this.selectedStationState() !== null,
  );
  readonly districtRequired = computed(
    () => this.districtTouched() && this.selectedStationState() === null,
  );
  readonly filteredViolations = computed(() =>
    filterViolations(this.violationFilterState(), this.violationTypes),
  );
  readonly violationFormValid = computed(() => this.violationForm().valid());

  setSelectedStation(station: PoliceStation | null): void {
    this.selectedStationState.set(station);
  }

  setAddress(value: string): void {
    this.addressState.set(value);
    if (this.addressForm.address().value() !== value) {
      this.addressForm.address().value.set(value);
    }
  }

  setViolation(value: string): void {
    this.violationState.set(value);
    if (this.violationForm.violation().value() !== value) {
      this.violationForm.violation().value.set(value);
    }
  }

  setLicensePlate(value: string): void {
    const cleaned = cleanLicensePlate(value);
    this.licensePlateState.set(cleaned);
    if (this.violationForm.licensePlate().value() !== cleaned) {
      this.violationForm.licensePlate().value.set(cleaned);
    }
  }

  setViolationFilter(value: string): void {
    this.violationFilterState.set(value);
  }

  markLocationTouched(): void {
    this.addressForm.address().markAsTouched();
    this.districtTouched.set(true);
  }

  markViolationTouched(): void {
    this.violationForm.violation().markAsTouched();
    this.violationForm.licensePlate().markAsTouched();
  }

  handleAddressInput(value: string, debounceMs: number): void {
    this.addressForm.address().value.set(value);
    this.clearAddressDebounce();
    this.addressDebounceTimer = setTimeout(() => {
      this.setAddress(value);
      this.autoSelectDistrict(value);
    }, debounceMs);
  }

  handleAddressPaste(pasted: string): void {
    if (!pasted) return;
    this.clearAddressDebounce();
    this.addressForm.address().value.set(pasted);
    queueMicrotask(() => {
      const normalized = normalizeAddress(this.addressForm.address().value());
      if (normalized !== this.addressForm.address().value()) {
        this.addressForm.address().value.set(normalized);
      }
      this.setAddress(normalized);
      this.autoSelectDistrict(normalized);
    });
  }

  handleViolationInput(value: string, debounceMs: number): void {
    this.violationForm.violation().value.set(value);
    this.clearViolationDebounce();
    this.violationDebounceTimer = setTimeout(() => {
      this.setViolation(value);
      this.violationFilterState.set(value);
    }, debounceMs);
  }

  handleViolationChange(): void {
    this.clearViolationDebounce();
    const value = this.violationForm.violation().value();
    this.setViolation(value);
    this.violationFilterState.set(value);
  }

  handleLicensePlateInput(raw: string): string {
    const cleaned = cleanLicensePlate(raw);
    this.setLicensePlate(cleaned);
    return cleaned;
  }

  showLicensePlateField(): void {
    this.showLicensePlateState.set(true);
  }

  clearLicensePlate(): void {
    this.violationForm.licensePlate().value.set('');
    this.licensePlateState.set('');
    this.showLicensePlateState.set(false);
  }

  clearAddressDebounce(): void {
    if (this.addressDebounceTimer) {
      clearTimeout(this.addressDebounceTimer);
      this.addressDebounceTimer = null;
    }
  }

  clearViolationDebounce(): void {
    if (this.violationDebounceTimer) {
      clearTimeout(this.violationDebounceTimer);
      this.violationDebounceTimer = null;
    }
  }

  async locateUser(): Promise<void> {
    if (this.isLocatingState()) return;
    this.clearAddressDebounce();
    this.isLocatingState.set(true);
    this.locationErrorState.set('');
    try {
      const position = await this.geocodingService.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const displayName = await this.geocodingService.reverseGeocode(latitude, longitude);
      this.setAddress(displayName);
      this.autoSelectDistrict(displayName);
      if (typeof navigator !== 'undefined') {
        navigator.vibrate?.(50);
      }
      this.locationStatusState.set(`${ZH_TW.location.locateSuccess}${displayName}`);
    } catch (e) {
      this.locationErrorState.set(e instanceof Error ? e.message : DEFAULT_GEOLOCATION_ERROR_MSG);
      this.locationStatusState.set('');
    } finally {
      this.isLocatingState.set(false);
    }
  }

  readonly compareStations = areStationsEqual;

  private autoSelectDistrict(address: string): void {
    const station = this.stationLookup.findStation(address);
    if (station) {
      this.setSelectedStation(station);
    }
  }
}
