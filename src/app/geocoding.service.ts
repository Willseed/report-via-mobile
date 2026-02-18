import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout, retry } from 'rxjs';
import { NOMINATIM_USER_AGENT } from './app.config';
import { ZH_TW } from './i18n';

interface NominatimAddress {
  city?: string;
  county?: string;
  suburb?: string;
  city_district?: string;
  town?: string;
  village?: string;
  road?: string;
  house_number?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
}

const FAST_POSITION_TIMEOUT_MS = 3000;
const ACCURATE_POSITION_TIMEOUT_MS = 10000;
const GEOCODE_REQUEST_TIMEOUT_MS = 8000;
const GEOCODE_RETRY_DELAY_MS = 1000;
const INVALID_COORDINATES_MSG = ZH_TW.geocoding.invalidCoordinates;
export const DEFAULT_GEOLOCATION_ERROR_MSG = ZH_TW.geocoding.defaultError;
export const GEOCODE_RATE_LIMITED_MSG = ZH_TW.geocoding.rateLimited;
export const GEOCODE_SERVICE_UNAVAILABLE_MSG = ZH_TW.geocoding.serviceUnavailable;
export const GEOCODE_CIRCUIT_OPEN_MSG = ZH_TW.geocoding.circuitOpen;

class GeolocationError extends Error {
  readonly PERMISSION_DENIED = 1;
  constructor(message: string, readonly code: number) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);
  private nominatimUserAgent = inject(NOMINATIM_USER_AGENT);
  private static readonly MAX_CACHE_SIZE = 100;
  private geocodeCache = new Map<string, string>();

  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;
  private static readonly MAX_FAILURES = 3;
  private static readonly CIRCUIT_COOLDOWN_MS = 30_000;

  private _circuitState = signal<'closed' | 'open' | 'half-open'>('closed');
  readonly fallbackToManualInput = computed(() => this._circuitState() !== 'closed');

  private isCircuitOpen(): boolean {
    if (this._circuitState() === 'closed') return false;
    if (Date.now() >= this.circuitOpenUntil) {
      this._circuitState.set('half-open');
      return false;
    }
    return true;
  }

  private openCircuit(): void {
    this._circuitState.set('open');
    this.circuitOpenUntil = Date.now() + GeocodingService.CIRCUIT_COOLDOWN_MS;
    this.consecutiveFailures = GeocodingService.MAX_FAILURES;
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= GeocodingService.MAX_FAILURES) {
      this.openCircuit();
    }
  }

  private resetCircuit(): void {
    this.consecutiveFailures = 0;
    this._circuitState.set('closed');
  }

  getCurrentPosition(): Promise<GeolocationPosition> {
    if (!('geolocation' in navigator)) {
      return Promise.reject(new Error(ZH_TW.geocoding.browserNotSupported));
    }

    return this.requestPosition({
      enableHighAccuracy: false,
      timeout: FAST_POSITION_TIMEOUT_MS,
    }).catch((error) => {
      if (error instanceof GeolocationError && error.code === error.PERMISSION_DENIED) {
        throw error;
      }
      return this.requestPosition({
        enableHighAccuracy: true,
        timeout: ACCURATE_POSITION_TIMEOUT_MS,
      });
    });
  }

  private requestPosition(options: PositionOptions): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new GeolocationError(ZH_TW.geocoding.permissionDenied, error.code));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new GeolocationError(ZH_TW.geocoding.positionUnavailable, error.code));
            break;
          case error.TIMEOUT:
            reject(new GeolocationError(ZH_TW.geocoding.timeout, error.code));
            break;
          default:
            reject(new GeolocationError(DEFAULT_GEOLOCATION_ERROR_MSG, error.code));
        }
      }, options);
    });
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error(INVALID_COORDINATES_MSG);
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error(INVALID_COORDINATES_MSG);
    }

    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = this.geocodeCache.get(cacheKey);
    if (cached) return cached;

    if (this.isCircuitOpen()) {
      throw new Error(GEOCODE_CIRCUIT_OPEN_MSG);
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-TW&addressdetails=1`;
    let data: NominatimResponse;
    try {
      data = await firstValueFrom(
        this.http
          .get<NominatimResponse>(url, {
            headers: { 'User-Agent': this.nominatimUserAgent },
          })
          .pipe(
            timeout(GEOCODE_REQUEST_TIMEOUT_MS),
            retry({ count: 1, delay: GEOCODE_RETRY_DELAY_MS }),
          )
      );
    } catch (error) {
      console.error('Geocoding error:', error);
      if (error instanceof HttpErrorResponse) {
        if (error.status === 429 || error.status === 503) {
          this.openCircuit();
          throw new Error(error.status === 429 ? GEOCODE_RATE_LIMITED_MSG : GEOCODE_SERVICE_UNAVAILABLE_MSG);
        }
      }
      this.recordFailure();
      throw new Error(ZH_TW.geocoding.queryFailed);
    }
    this.resetCircuit();
    const a = data.address;
    let result: string | undefined;
    if (a) {
      const city = a.city ?? a.county ?? '';
      const district = a.suburb ?? a.city_district ?? a.town ?? a.village ?? '';
      const road = a.road ?? '';
      const number = a.house_number ?? '';
      const formatted = `${city}${district}${road}${number}`;
      if (formatted) result = formatted;
    }
    if (!result && data.display_name) result = data.display_name;
    if (!result) throw new Error(ZH_TW.geocoding.parseError);

    if (this.geocodeCache.size >= GeocodingService.MAX_CACHE_SIZE) {
      const firstKey = this.geocodeCache.keys().next().value;
      if (firstKey !== undefined) this.geocodeCache.delete(firstKey);
    }
    this.geocodeCache.set(cacheKey, result);
    return result;
  }
}
