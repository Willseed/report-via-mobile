import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  DestroyRef,
  inject,
  model,
  signal,
} from '@angular/core';
import { form, FormField, required, maxLength } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { POLICE_STATIONS, PoliceStation, findStationByAddress } from '../../police-stations';
import { GeocodingService, DEFAULT_GEOLOCATION_ERROR_MSG } from '../../geocoding.service';

export const DISTRICT_SEARCH_DEBOUNCE_MS = 300;
export const ADDRESS_MAX_LENGTH = 100;

@Component({
  selector: 'app-location-input',
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './location-input.html',
  styleUrl: './location-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationInput {
  private geocodingService = inject(GeocodingService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  readonly address = model('');
  readonly district = model<PoliceStation | null>(null);

  protected isLocating = signal(false);
  protected locationError = signal('');
  protected stations = POLICE_STATIONS;

  private addressModel = signal({ address: '' });
  protected addressForm = form(this.addressModel, (schema) => {
    required(schema.address, { message: '請輸入事發地址。' });
    maxLength(schema.address, ADDRESS_MAX_LENGTH, { message: '地址不可超過 100 字。' });
  });

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
    });
  }

  readonly districtMismatch = computed(() => {
    const address = this.address();
    const selected = this.district();
    const stationFromAddress = findStationByAddress(address);
    if (!stationFromAddress || !selected) return false;
    return stationFromAddress.district !== selected.district;
  });

  protected onAddressInput(event: Event): void {
    const value = (event.target as EventTarget & { value: string }).value;
    this.addressForm.address().value.set(value);
    this.address.set(value);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.autoSelectDistrict(value);
    }, DISTRICT_SEARCH_DEBOUNCE_MS);
  }

  protected onDistrictChange(station: PoliceStation): void {
    this.district.set(station);
  }

  protected compareStations(a: PoliceStation | null, b: PoliceStation | null): boolean {
    if (!a || !b) return a === b;
    return a.district === b.district && a.phoneNumber === b.phoneNumber;
  }

  protected async locateUser(): Promise<void> {
    if (this.isLocating()) return;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isLocating.set(true);
    this.locationError.set('');
    try {
      const position = await this.geocodingService.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const displayName = await this.geocodingService.reverseGeocode(latitude, longitude);
      this.addressForm.address().value.set(displayName);
      this.address.set(displayName);
      this.autoSelectDistrict(displayName);
    } catch (e) {
      this.locationError.set(e instanceof Error ? e.message : DEFAULT_GEOLOCATION_ERROR_MSG);
    } finally {
      this.isLocating.set(false);
    }
  }

  private districtTouched = signal(false);

  markAsTouched(): void {
    this.addressForm.address().markAsTouched();
    this.districtTouched.set(true);
    queueMicrotask(() => this.cdr.detectChanges());
  }

  readonly valid = computed(() => this.addressForm().valid() && this.district() !== null);

  readonly districtRequired = computed(() => this.districtTouched() && this.district() === null);

  private autoSelectDistrict(address: string): void {
    const station = findStationByAddress(address);
    if (station) {
      this.district.set(station);
    }
  }
}
