import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class GeocodingService {
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
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-TW`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'report-via-mobile' },
    });
    if (!response.ok) {
      throw new Error('反向地理編碼失敗。');
    }
    const data = await response.json();
    return data.display_name ?? '';
  }
}
