import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeocodingService } from './geocoding.service';

describe('GeocodingService', () => {
  let service: GeocodingService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GeocodingService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  describe('getCurrentPosition', () => {
    it('should resolve with position on success', async () => {
      const mockPosition = {
        coords: { latitude: 25.033, longitude: 121.565 },
      } as GeolocationPosition;

      const getCurrentPositionSpy = vi.fn((success: PositionCallback) => {
        success(mockPosition);
      });
      vi.stubGlobal('navigator', {
        geolocation: { getCurrentPosition: getCurrentPositionSpy },
      });

      const result = await service.getCurrentPosition();
      expect(result).toBe(mockPosition);
    });

    it('should reject when geolocation is not supported', async () => {
      vi.stubGlobal('navigator', { geolocation: undefined });
      await expect(service.getCurrentPosition()).rejects.toThrow('您的瀏覽器不支援定位功能。');
    });

    it('should reject with permission denied message', async () => {
      const getCurrentPositionSpy = vi.fn(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 1,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: '',
          });
        },
      );
      vi.stubGlobal('navigator', {
        geolocation: { getCurrentPosition: getCurrentPositionSpy },
      });

      await expect(service.getCurrentPosition()).rejects.toThrow('定位權限被拒絕');
    });

    it('should reject with position unavailable message', async () => {
      const getCurrentPositionSpy = vi.fn(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 2,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: '',
          });
        },
      );
      vi.stubGlobal('navigator', {
        geolocation: { getCurrentPosition: getCurrentPositionSpy },
      });

      await expect(service.getCurrentPosition()).rejects.toThrow('無法取得位置資訊');
    });

    it('should reject with timeout message', async () => {
      const getCurrentPositionSpy = vi.fn(
        (_success: PositionCallback, error: PositionErrorCallback) => {
          error({
            code: 3,
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
            message: '',
          });
        },
      );
      vi.stubGlobal('navigator', {
        geolocation: { getCurrentPosition: getCurrentPositionSpy },
      });

      await expect(service.getCurrentPosition()).rejects.toThrow('定位逾時');
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });
  });

  describe('reverseGeocode', () => {
    it('should return formatted address from address fields', async () => {
      const mockResponse = {
        display_name: '7號, 信義路五段, 信義區, 臺北市, 110, 臺灣',
        address: {
          house_number: '7號',
          road: '信義路五段',
          suburb: '信義區',
          city: '臺北市',
        },
      };

      const promise = service.reverseGeocode(25.033, 121.565);
      const req = httpTesting.expectOne((r) => r.url.includes('addressdetails=1'));
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toBe('臺北市信義區信義路五段7號');
    });

    it('should use county and town as fallback for city and district', async () => {
      const mockResponse = {
        display_name: '中正路100號, 頭城鎮, 宜蘭縣, 臺灣',
        address: {
          house_number: '100號',
          road: '中正路',
          town: '頭城鎮',
          county: '宜蘭縣',
        },
      };

      const promise = service.reverseGeocode(24.859, 121.823);
      const req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toBe('宜蘭縣頭城鎮中正路100號');
    });

    it('should fallback to display_name when address fields are insufficient', async () => {
      const mockResponse = {
        display_name: '某個地方, 臺灣',
        address: {},
      };

      const promise = service.reverseGeocode(25.033, 121.565);
      const req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush(mockResponse);

      const result = await promise;
      expect(result).toBe('某個地方, 臺灣');
    });

    it('should throw on HTTP error after retries', async () => {
      vi.useFakeTimers();
      const promise = service.reverseGeocode(25.033, 121.565);

      // Initial attempt
      let req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      // Retry 1 after 1s delay
      await vi.advanceTimersByTimeAsync(1000);
      req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      // Retry 2 after 1s delay
      await vi.advanceTimersByTimeAsync(1000);
      req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      await expect(promise).rejects.toThrow('地址查詢失敗，請稍後再試。');
      vi.useRealTimers();
    });

    it('should succeed on retry after initial failure', async () => {
      vi.useFakeTimers();
      const promise = service.reverseGeocode(25.033, 121.565);

      // Initial attempt fails
      let req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush('Error', { status: 500, statusText: 'Server Error' });

      // Retry 1 after 1s delay succeeds
      await vi.advanceTimersByTimeAsync(1000);
      req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush({
        display_name: '臺北市',
        address: { city: '臺北市' },
      });

      const result = await promise;
      expect(result).toBe('臺北市');
      vi.useRealTimers();
    });

    it('should throw on request timeout', async () => {
      vi.useFakeTimers();
      const promise = service.reverseGeocode(25.033, 121.565);

      // Attach rejection handler early to prevent unhandled rejection warning
      const rejection = expect(promise).rejects.toThrow('地址查詢失敗，請稍後再試。');

      // Initial attempt times out (request gets cancelled by timeout)
      httpTesting.expectOne((r) => r.url.includes('nominatim'));
      await vi.advanceTimersByTimeAsync(15000);

      // Retry 1 after 1s delay also times out
      await vi.advanceTimersByTimeAsync(1000);
      httpTesting.expectOne((r) => r.url.includes('nominatim'));
      await vi.advanceTimersByTimeAsync(15000);

      // Retry 2 after 1s delay also times out
      await vi.advanceTimersByTimeAsync(1000);
      httpTesting.expectOne((r) => r.url.includes('nominatim'));
      await vi.advanceTimersByTimeAsync(15000);

      await rejection;
      vi.useRealTimers();
    });

    it('should return empty string when no address and no display_name', async () => {
      const promise = service.reverseGeocode(25.033, 121.565);
      const req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush({});

      const result = await promise;
      expect(result).toBe('');
    });

    it('should throw on invalid latitude', async () => {
      await expect(service.reverseGeocode(91, 121)).rejects.toThrow('無效的座標資訊。');
      await expect(service.reverseGeocode(-91, 121)).rejects.toThrow('無效的座標資訊。');
      await expect(service.reverseGeocode(NaN, 121)).rejects.toThrow('無效的座標資訊。');
    });

    it('should throw on invalid longitude', async () => {
      await expect(service.reverseGeocode(25, 181)).rejects.toThrow('無效的座標資訊。');
      await expect(service.reverseGeocode(25, -181)).rejects.toThrow('無效的座標資訊。');
      await expect(service.reverseGeocode(25, Infinity)).rejects.toThrow('無效的座標資訊。');
    });

    it('should include User-Agent header in request', async () => {
      const promise = service.reverseGeocode(25.033, 121.565);
      const req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      expect(req.request.headers.get('User-Agent')).toBe(
        'ReportViaMobileApp/1.0 (https://github.com/Willseed/report-via-mobile)',
      );
      req.flush({ display_name: 'test' });
      await promise;
    });
  });
});
