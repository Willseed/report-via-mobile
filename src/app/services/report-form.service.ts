import { Injectable, computed, signal } from '@angular/core';
import { form, maxLength, pattern, required } from '@angular/forms/signals';
import { ZH_TW } from '../i18n';
import { ADDRESS_MAX_LENGTH, areStationsEqual } from '../domain/address.utils';
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
export class ReportFormService {
  private violationDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly addressState = signal('');
  private readonly violationState = signal('');
  private readonly licensePlateState = signal('');
  private readonly licensePlatesState = signal<readonly string[]>([]);
  private readonly selectedStationState = signal<PoliceStation | null>(null);
  private readonly districtTouched = signal(false);
  private readonly showLicensePlateState = signal(false);
  private readonly violationFilterState = signal('');

  private readonly addressModel = signal({ address: '' });
  readonly addressForm = form(this.addressModel, (schema) => {
    required(schema.address, { message: ZH_TW.location.addressRequired });
    maxLength(schema.address, ADDRESS_MAX_LENGTH, { message: ZH_TW.location.addressMaxLength });
  });

  private readonly violationModel = signal({ violation: '', licensePlate: '' });
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
  readonly licensePlates = this.licensePlatesState.asReadonly();
  readonly station = computed(() => this.selectedStationState());
  readonly district = computed(() => this.selectedStationState()?.district ?? null);
  readonly showLicensePlate = this.showLicensePlateState.asReadonly();
  readonly violationFilter = this.violationFilterState.asReadonly();

  readonly stations = POLICE_STATIONS;
  readonly violationTypes = VIOLATION_TYPES;

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

  readonly compareStations = areStationsEqual;

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
    this.setLicensePlates(value ? [value] : []);
  }

  setLicensePlates(values: readonly string[]): void {
    const cleaned = values.map((value) => cleanLicensePlate(value)).filter(Boolean);
    const firstPlate = cleaned[0] ?? '';
    this.licensePlatesState.set(cleaned);
    this.licensePlateState.set(firstPlate);
    if (this.violationForm.licensePlate().value() !== firstPlate) {
      this.violationForm.licensePlate().value.set(firstPlate);
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

  handleViolationInput(value: string, debounceMs: number): void {
    this.violationForm.violation().value.set(value);
    this.clearViolationDebounce();
    this.violationDebounceTimer = setTimeout(() => {
      this.setViolation(value);
      this.violationFilterState.set(value);
    }, debounceMs);
  }

  handleViolationChange(value = this.violationForm.violation().value()): void {
    this.clearViolationDebounce();
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
    this.setLicensePlates([]);
    this.showLicensePlateState.set(false);
  }

  clearLocation(): void {
    this.setAddress('');
    this.selectedStationState.set(null);
    this.districtTouched.set(false);
  }

  resetForm(): void {
    this.clearViolationDebounce();
    this.clearLocation();
    this.setViolation('');
    this.setLicensePlate('');
    this.violationFilterState.set('');
    this.showLicensePlateState.set(false);
  }

  clearViolationDebounce(): void {
    if (this.violationDebounceTimer) {
      clearTimeout(this.violationDebounceTimer);
      this.violationDebounceTimer = null;
    }
  }
}
