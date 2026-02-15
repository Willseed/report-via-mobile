import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeocodingService } from './geocoding.service';

function mockGeoError(code: number): GeolocationPositionError {
  return { code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' };
}

type GeoImplFn = (
  success: PositionCallback,
  error: PositionErrorCallback,
  options?: PositionOptions,
) => void;

function stubGeolocation(impl: GeoImplFn): ReturnType<typeof vi.fn> {
  const spy = vi.fn(impl);
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: spy } });
  return spy;
}

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
    const mockPosition = {
      coords: { latitude: 25.033, longitude: 121.565 },
    } as GeolocationPosition;

    it('should resolve with position on success', async () => {
      stubGeolocation((success: PositionCallback) => success(mockPosition));

      const result = await service.getCurrentPosition();
      expect(result).toBe(mockPosition);
    });

    it('should reject when geolocation is not supported', async () => {
      vi.stubGlobal('navigator', {});
      await expect(service.getCurrentPosition()).rejects.toThrow('您的瀏覽器不支援定位功能。');
    });

    it('should reject with permission denied message', async () => {
      stubGeolocation((_s: PositionCallback, err: PositionErrorCallback) => err(mockGeoError(1)));
      await expect(service.getCurrentPosition()).rejects.toThrow('定位權限被拒絕');
    });

    it('should reject with position unavailable message', async () => {
      stubGeolocation((_s: PositionCallback, err: PositionErrorCallback) => err(mockGeoError(2)));
      await expect(service.getCurrentPosition()).rejects.toThrow('無法取得位置資訊');
    });

    it('should reject with timeout message', async () => {
      stubGeolocation((_s: PositionCallback, err: PositionErrorCallback) => err(mockGeoError(3)));
      await expect(service.getCurrentPosition()).rejects.toThrow('定位逾時');
    });

    it('should reject with default message for unknown error code', async () => {
      stubGeolocation((_s: PositionCallback, err: PositionErrorCallback) => err(mockGeoError(99)));
      await expect(service.getCurrentPosition()).rejects.toThrow('定位失敗，請稍後再試。');
    });

    it('should try fast positioning first, then fall back to high accuracy', async () => {
      const spy = stubGeolocation(
        (success: PositionCallback, error: PositionErrorCallback, options?: PositionOptions) => {
          if (!options?.enableHighAccuracy) {
            error(mockGeoError(3));
          } else {
            success(mockPosition);
          }
        },
      );

      const result = await service.getCurrentPosition();
      expect(result).toBe(mockPosition);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should not retry when permission is denied', async () => {
      const spy = stubGeolocation((_s: PositionCallback, err: PositionErrorCallback) =>
        err(mockGeoError(1)),
      );

      await expect(service.getCurrentPosition()).rejects.toThrow('定位權限被拒絕');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });
  });

  describe('reverseGeocode', () => {
    async function flushReverseGeocode(
      lat: number,
      lon: number,
      response: object,
    ): Promise<string> {
      const promise = service.reverseGeocode(lat, lon);
      const req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush(response);
      return promise;
    }

    it('should return formatted address from address fields', async () => {
      const promise = service.reverseGeocode(25.033, 121.565);
      const req = httpTesting.expectOne((r) => r.url.includes('addressdetails=1'));
      expect(req.request.method).toBe('GET');
      req.flush({
        display_name: '7號, 信義路五段, 信義區, 臺北市, 110, 臺灣',
        address: { house_number: '7號', road: '信義路五段', suburb: '信義區', city: '臺北市' },
      });

      const result = await promise;
      expect(result).toBe('臺北市信義區信義路五段7號');
    });

    it('should use county and town as fallback for city and district', async () => {
      const result = await flushReverseGeocode(24.859, 121.823, {
        display_name: '中正路100號, 頭城鎮, 宜蘭縣, 臺灣',
        address: { house_number: '100號', road: '中正路', town: '頭城鎮', county: '宜蘭縣' },
      });
      expect(result).toBe('宜蘭縣頭城鎮中正路100號');
    });

    it('should fallback to display_name when address fields are insufficient', async () => {
      const result = await flushReverseGeocode(25.033, 121.565, {
        display_name: '某個地方, 臺灣',
        address: {},
      });
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
      await vi.advanceTimersByTimeAsync(8000);

      // Retry 1 after 1s delay also times out
      await vi.advanceTimersByTimeAsync(1000);
      httpTesting.expectOne((r) => r.url.includes('nominatim'));
      await vi.advanceTimersByTimeAsync(8000);

      await rejection;
      vi.useRealTimers();
    });

    it('should throw when no address and no display_name', async () => {
      await expect(flushReverseGeocode(25.033, 121.565, {})).rejects.toThrow(
        '無法解析地址，請手動輸入。',
      );
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

    it('should return cached result for nearby coordinates', async () => {
      const mockResponse = {
        display_name: '臺北市信義區',
        address: { city: '臺北市', suburb: '信義區' },
      };

      // First call — hits network
      const result1 = await flushReverseGeocode(25.03301, 121.56501, mockResponse);
      expect(result1).toBe('臺北市信義區');

      // Second call with nearby coords (same toFixed(4) = 25.0330, 121.5650) — should use cache
      const result2 = await service.reverseGeocode(25.03304, 121.56504);
      httpTesting.expectNone((r) => r.url.includes('nominatim'));
      expect(result2).toBe('臺北市信義區');
    });

    it('should not cache failed requests', async () => {
      vi.useFakeTimers();

      // First call fails
      const promise1 = service.reverseGeocode(25.033, 121.565);
      let req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush('Error', { status: 500, statusText: 'Server Error' });
      await vi.advanceTimersByTimeAsync(1000);
      req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush('Error', { status: 500, statusText: 'Server Error' });
      await expect(promise1).rejects.toThrow('地址查詢失敗');

      // Second call should still hit network (not cached)
      const result2 = await flushReverseGeocode(25.033, 121.565, {
        display_name: '臺北市',
        address: { city: '臺北市' },
      });
      expect(result2).toBe('臺北市');

      vi.useRealTimers();
    });

    it('should not include User-Agent header in request', async () => {
      const promise = service.reverseGeocode(25.033, 121.565);
      const req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      expect(req.request.headers.has('User-Agent')).toBe(false);
      req.flush({ display_name: 'test' });
      await promise;
    });

    it('should evict oldest cache entry when cache exceeds max size', async () => {
      // Fill cache to MAX_CACHE_SIZE (100) with unique coords
      for (let i = 0; i < 100; i++) {
        const lat = 20 + i * 0.01;
        const promise = service.reverseGeocode(lat, 121);
        const req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
        req.flush({ display_name: `地址${i}`, address: { city: `城市${i}` } });
        await promise;
      }

      // Add one more — should evict the first entry (lat=20.0000)
      const promise = service.reverseGeocode(30, 121);
      const req = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req.flush({ display_name: '新地址', address: { city: '新城市' } });
      await promise;

      // The first entry should be evicted — request should go to network
      const promise2 = service.reverseGeocode(20, 121);
      const req2 = httpTesting.expectOne((r) => r.url.includes('nominatim'));
      req2.flush({ display_name: '舊地址', address: { city: '舊城市' } });
      const result = await promise2;
      expect(result).toBe('舊城市');
    });
  });
});
