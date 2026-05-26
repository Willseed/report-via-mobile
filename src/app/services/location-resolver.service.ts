import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, of, switchMap, takeUntil } from 'rxjs';
import { DEFAULT_GEOLOCATION_ERROR_MSG, GeocodingService } from '../geocoding.service';
import { StationLookupService } from '../police-stations';
import { ZH_TW } from '../i18n';
import { normalizeAddress } from '../domain/address.utils';
import { ReportFormService } from './report-form.service';

@Injectable({ providedIn: 'root' })
export class LocationResolverService {
  private readonly geocodingService = inject(GeocodingService);
  private readonly stationLookup = inject(StationLookupService);
  private readonly formService = inject(ReportFormService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly addressInput$ = new Subject<{ value: string; debounceMs: number }>();
  private readonly addressCancel$ = new Subject<void>();

  private readonly isLocatingState = signal(false);
  private readonly locationErrorState = signal('');
  private readonly locationStatusState = signal('');

  readonly isLocating = this.isLocatingState.asReadonly();
  readonly locationError = this.locationErrorState.asReadonly();
  readonly locationStatus = this.locationStatusState.asReadonly();
  readonly manualInputFallback = computed(
    () => this.geocodingService.fallbackToManualInput(),
  );

  constructor() {
    this.addressInput$
      .pipe(
        switchMap(({ value, debounceMs }) =>
          of(value).pipe(debounceTime(debounceMs), takeUntil(this.addressCancel$)),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        this.formService.setAddress(value);
        this.autoSelectDistrict(value);
      });
  }

  handleAddressInput(value: string, debounceMs: number): void {
    this.formService.addressForm.address().value.set(value);
    this.clearAddressDebounce();
    this.addressInput$.next({ value, debounceMs });
  }

  handleAddressPaste(pasted: string): void {
    if (!pasted) return;
    this.clearAddressDebounce();
    this.formService.addressForm.address().value.set(pasted);
    queueMicrotask(() => {
      const normalized = normalizeAddress(this.formService.addressForm.address().value());
      if (normalized !== this.formService.addressForm.address().value()) {
        this.formService.addressForm.address().value.set(normalized);
      }
      this.formService.setAddress(normalized);
      this.autoSelectDistrict(normalized);
    });
  }

  clearAddressDebounce(): void {
    this.addressCancel$.next();
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
      this.formService.setAddress(displayName);
      this.autoSelectDistrict(displayName);
      const navigatorRef = 'navigator' in globalThis ? globalThis.navigator : undefined;
      if (navigatorRef && typeof navigatorRef.vibrate === 'function') {
        navigatorRef.vibrate(50);
      }
      this.locationStatusState.set(`${ZH_TW.location.locateSuccess}${displayName}`);
    } catch (e) {
      this.locationErrorState.set(e instanceof Error ? e.message : DEFAULT_GEOLOCATION_ERROR_MSG);
      this.locationStatusState.set('');
    } finally {
      this.isLocatingState.set(false);
    }
  }

  private autoSelectDistrict(address: string): void {
    const station = this.stationLookup.findStation(address);
    if (station) {
      this.formService.setSelectedStation(station);
    }
  }
}
