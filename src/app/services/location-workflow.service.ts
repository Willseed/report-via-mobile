import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { PoliceStation } from '../domain/police-stations';
import { LocationResolverService } from './location-resolver.service';
import { MessageComposerService } from './message-composer.service';
import { ReportFormService } from './report-form.service';

export const ADDRESS_LOOKUP_DEBOUNCE_MS = 300;

const readOnlineStatus = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine;

@Injectable({ providedIn: 'root' })
export class LocationWorkflowService {
  private readonly form = inject(ReportFormService);
  private readonly location = inject(LocationResolverService);
  private readonly composer = inject(MessageComposerService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly isOnlineState = signal(readOnlineStatus());
  private readonly handleOnline = () => this.isOnlineState.set(true);
  private readonly handleOffline = () => this.isOnlineState.set(false);

  readonly addressForm = this.form.addressForm;
  readonly stations = this.form.stations;
  readonly compareStations = this.form.compareStations;

  readonly address = this.form.address;
  readonly station = this.form.station;
  readonly isLocating = this.location.isLocating;
  readonly isOnline = this.isOnlineState.asReadonly();
  readonly isManualAddress = this.location.manualInputFallback;
  readonly isAddressValid = this.form.locationValid;
  readonly hasDistrictMismatch = this.composer.districtMismatch;
  readonly currentDistrict = this.form.district;
  readonly effectiveDistrict = computed(
    () => this.form.station()?.district ?? this.composer.stationFromAddress()?.district ?? null,
  );
  readonly displayStation = computed(
    () => this.form.station() ?? this.composer.stationFromAddress(),
  );

  readonly locationError = this.location.locationError;
  readonly locationStatus = this.location.locationStatus;
  readonly districtRequired = this.form.districtRequired;

  constructor() {
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('online', this.handleOnline);
      globalThis.addEventListener('offline', this.handleOffline);
      this.destroyRef.onDestroy(() => {
        globalThis.removeEventListener('online', this.handleOnline);
        globalThis.removeEventListener('offline', this.handleOffline);
      });
    }
  }

  locateUser(): Promise<void> {
    return this.location.locateUser();
  }

  updateAddress(value: string): void {
    this.location.handleAddressInput(value, ADDRESS_LOOKUP_DEBOUNCE_MS);
  }

  updateManualAddress(value: string): void {
    this.location.resolveManualAddress(value);
  }

  updateStation(station: PoliceStation | null): void {
    this.form.setSelectedStation(station);
  }

  clearLocation(): void {
    this.location.clearAddressDebounce();
    this.form.clearLocation();
    this.location.resetLocationState();
  }

  resetLocationState(): void {
    this.location.clearAddressDebounce();
    this.location.resetLocationState();
  }

  markAsTouched(): void {
    this.form.markLocationTouched();
  }
}
