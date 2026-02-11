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

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private http = inject(HttpClient);

  getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('您的瀏覽器不支援定位功能。'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('定位權限被拒絕，請允許存取位置資訊。'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('無法取得位置資訊。'));
            break;
          case error.TIMEOUT:
            reject(new Error('定位逾時，請稍後再試。'));
            break;
          default:
            reject(new Error('定位失敗，請稍後再試。'));
        }
      }, { timeout: 10000 });
    });
  }

  async reverseGeocode(lat: number, lng: number): Promise<string> {
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new Error('無效的座標資訊。');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new Error('無效的座標資訊。');
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-TW&addressdetails=1`;
    let data: NominatimResponse;
    try {
      data = await firstValueFrom(
        this.http
          .get<NominatimResponse>(url, {
            headers: {
              'User-Agent': 'ReportViaMobileApp/1.0 (https://github.com/Willseed/report-via-mobile)',
            },
          })
          .pipe(timeout(15000), retry({ count: 2, delay: 1000 }))
      );
    } catch (error) {
      console.error('Geocoding error:', error);
      throw new Error('地址查詢失敗，請稍後再試。');
    }
    const a = data.address;
    if (a) {
      const city = a.city ?? a.county ?? '';
      const district = a.suburb ?? a.city_district ?? a.town ?? a.village ?? '';
      const road = a.road ?? '';
      const number = a.house_number ?? '';
      const formatted = `${city}${district}${road}${number}`;
      if (formatted) return formatted;
    }
    return data.display_name ?? '';
  }
}
