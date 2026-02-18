import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { PoliceStation } from '../domain/police-stations';
import { LocationResolverService } from './location-resolver.service';
import { MessageComposerService } from './message-composer.service';
import { ReportFormService } from './report-form.service';

@Injectable({ providedIn: 'root' })
export class ReportStateService {
  private form = inject(ReportFormService);
  private location = inject(LocationResolverService);
  private composer = inject(MessageComposerService);
  private destroyRef = inject(DestroyRef);

  private isOnlineState = signal(navigator.onLine);
  readonly isOnline = this.isOnlineState.asReadonly();

  private handleOnline = () => this.isOnlineState.set(true);
  private handleOffline = () => this.isOnlineState.set(false);

  readonly addressForm = this.form.addressForm;
  readonly violationForm = this.form.violationForm;

  readonly address = this.form.address;
  readonly violation = this.form.violation;
  readonly licensePlate = this.form.licensePlate;
  readonly station = this.form.station;
  readonly district = this.form.district;
  readonly showLicensePlate = this.form.showLicensePlate;
  readonly violationFilter = this.form.violationFilter;
  readonly isLocating = this.location.isLocating;
  readonly locationError = this.location.locationError;
  readonly locationStatus = this.location.locationStatus;
  readonly manualInputFallback = this.location.manualInputFallback;

  readonly stations = this.form.stations;
  readonly violationTypes = this.form.violationTypes;

  readonly stationFromAddress = this.composer.stationFromAddress;
  readonly districtMismatch = this.composer.districtMismatch;
  readonly pendingPreview = this.composer.pendingPreview;
  readonly composedMessage = this.composer.composedMessage;

  readonly locationValid = this.form.locationValid;
  readonly districtRequired = this.form.districtRequired;
  readonly filteredViolations = this.form.filteredViolations;
  readonly violationFormValid = this.form.violationFormValid;

  readonly compareStations = this.form.compareStations;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('online', this.handleOnline);
        window.removeEventListener('offline', this.handleOffline);
      });
    }
  }

  setSelectedStation(station: PoliceStation | null): void {
    this.form.setSelectedStation(station);
  }

  setAddress(value: string): void {
    this.form.setAddress(value);
  }

  setViolation(value: string): void {
    this.form.setViolation(value);
  }

  setLicensePlate(value: string): void {
    this.form.setLicensePlate(value);
  }

  setViolationFilter(value: string): void {
    this.form.setViolationFilter(value);
  }

  markLocationTouched(): void {
    this.form.markLocationTouched();
  }

  markViolationTouched(): void {
    this.form.markViolationTouched();
  }

  handleAddressInput(value: string, debounceMs: number): void {
    this.location.handleAddressInput(value, debounceMs);
  }

  handleAddressPaste(pasted: string): void {
    this.location.handleAddressPaste(pasted);
  }

  handleViolationInput(value: string, debounceMs: number): void {
    this.form.handleViolationInput(value, debounceMs);
  }

  handleViolationChange(): void {
    this.form.handleViolationChange();
  }

  handleLicensePlateInput(raw: string): string {
    return this.form.handleLicensePlateInput(raw);
  }

  showLicensePlateField(): void {
    this.form.showLicensePlateField();
  }

  clearLicensePlate(): void {
    this.form.clearLicensePlate();
  }

  clearAddressDebounce(): void {
    this.location.clearAddressDebounce();
  }

  clearViolationDebounce(): void {
    this.form.clearViolationDebounce();
  }

  locateUser(): Promise<void> {
    return this.location.locateUser();
  }
}
