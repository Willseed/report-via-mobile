import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout, retry } from 'rxjs';

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
const INVALID_COORDINATES_MSG = '無效的座標資訊。';
export const DEFAULT_GEOLOCATION_ERROR_MSG = '定位失敗，請稍後再試。';

class GeolocationError extends Error {
  readonly PERMISSION_DENIED = 1;
  constructor(message: string, readonly code: number) {
    super(message);
  }
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);
  private static readonly MAX_CACHE_SIZE = 100;
  private geocodeCache = new Map<string, string>();

  getCurrentPosition(): Promise<GeolocationPosition> {
    if (!('geolocation' in navigator)) {
      return Promise.reject(new Error('您的瀏覽器不支援定位功能。'));
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
            reject(new GeolocationError('定位權限被拒絕，請允許存取位置資訊。', error.code));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new GeolocationError('無法取得位置資訊。', error.code));
            break;
          case error.TIMEOUT:
            reject(new GeolocationError('定位逾時，請稍後再試。', error.code));
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

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-TW&addressdetails=1`;
    let data: NominatimResponse;
    try {
      data = await firstValueFrom(
        this.http
          .get<NominatimResponse>(url)
          .pipe(
            timeout(GEOCODE_REQUEST_TIMEOUT_MS),
            retry({ count: 1, delay: GEOCODE_RETRY_DELAY_MS }),
          )
      );
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('地址查詢失敗，請稍後再試。');
    }
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
    if (!result) throw new Error('無法解析地址，請手動輸入。');

    if (this.geocodeCache.size >= GeocodingService.MAX_CACHE_SIZE) {
      const firstKey = this.geocodeCache.keys().next().value;
      if (firstKey !== undefined) this.geocodeCache.delete(firstKey);
    }
    this.geocodeCache.set(cacheKey, result);
    return result;
  }
}
