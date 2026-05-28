import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NOMINATIM_USER_AGENT } from './app.config';
import {
  GeocodingService,
  GEOCODE_CIRCUIT_OPEN_MSG,
  GEOCODE_RATE_LIMITED_MSG,
  GEOCODE_SERVICE_UNAVAILABLE_MSG,
} from './geocoding.service';
import { mockGeolocationPosition } from '../testing/geolocation';

function mockGeoError(code: number): GeolocationPositionError {
  return { code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' };
}

type GeoImplFn = (
  success: PositionCallback,
  error: PositionErrorCallback,
  options?: PositionOptions,
) => void;

const SERVER_ERROR = { status: 500, statusText: 'Server Error' };
const RATE_LIMIT_ERROR = { status: 429, statusText: 'Too Many Requests' };
const SERVICE_UNAVAILABLE_ERROR = { status: 503, statusText: 'Service Unavailable' };
const TAIPEI_RESPONSE = { display_name: '臺北市', address: { city: '臺北市' } };

function stubGeolocation(impl: GeoImplFn): ReturnType<typeof vi.fn> {
  const spy = vi.fn(impl);
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: spy } });
  return spy;
}

function expectNominatimRequest(httpTesting: HttpTestingController) {
  return httpTesting.expectOne((r) => r.url.includes('nominatim'));
}

async function flushReverseGeocode(
  service: GeocodingService,
  httpTesting: HttpTestingController,
  lat: number,
  lon: number,
  response: object,
): Promise<string> {
  const promise = service.reverseGeocode(lat, lon);
  const req = expectNominatimRequest(httpTesting);
  req.flush(response);
  return promise;
}

async function withFakeTimers(testFn: () => Promise<void>): Promise<void> {
  vi.useFakeTimers();
  try {
    await testFn();
  } finally {
    vi.useRealTimers();
  }
}

async function flushFailedAttempt(
  httpTesting: HttpTestingController,
  error = SERVER_ERROR,
): Promise<void> {
  expectNominatimRequest(httpTesting).flush('Error', error);
  await vi.advanceTimersByTimeAsync(1000);
}

async function failReverseGeocodeAfterRetry(
  service: GeocodingService,
  httpTesting: HttpTestingController,
  lat: number,
  expectedMessage = '地址查詢失敗',
  error = SERVER_ERROR,
): Promise<void> {
  const promise = service.reverseGeocode(lat, 121);
  await flushFailedAttempt(httpTesting, error);
  expectNominatimRequest(httpTesting).flush('Error', error);
  await expect(promise).rejects.toThrow(expectedMessage);
}

async function openCircuit(
  service: GeocodingService,
  httpTesting: HttpTestingController,
): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await failReverseGeocodeAfterRetry(service, httpTesting, 25 + i * 0.01);
  }
}

function muteExpectedGeocodingErrors() {
  return vi.spyOn(console, 'error').mockImplementation(() => undefined);
}

function expectGeocodingErrorsLogged(
  consoleErrorSpy: ReturnType<typeof muteExpectedGeocodingErrors>,
  count = 1,
): void {
  expect(consoleErrorSpy).toHaveBeenCalledTimes(count);
  expect(consoleErrorSpy).toHaveBeenCalledWith('Geocoding error:', expect.anything());
  for (const [message, error] of consoleErrorSpy.mock.calls) {
    expect(message).toBe('Geocoding error:');
    expect(error).toBeDefined();
  }
}

describe('GeocodingService', () => {
  let service: GeocodingService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NOMINATIM_USER_AGENT, useValue: 'report-via-mobile (https://tools.pylot.dev)' },
      ],
    });
    service = TestBed.inject(GeocodingService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    vi.restoreAllMocks();
  });

  describe('getCurrentPosition', () => {
    const mockPosition = mockGeolocationPosition();

    it('should resolve with position on success', async () => {
      stubGeolocation((success: PositionCallback) => { success(mockPosition); });

      const result = await service.getCurrentPosition();
      expect(result).toBe(mockPosition);
    });

    it('should reject when geolocation is not supported', async () => {
      vi.stubGlobal('navigator', {});
      await expect(service.getCurrentPosition()).rejects.toThrow('您的瀏覽器不支援定位功能。');
    });

    it.each([
      { code: 1, message: '定位權限被拒絕' },
      { code: 2, message: '無法取得位置資訊' },
      { code: 3, message: '定位逾時' },
      { code: 99, message: '定位失敗，請稍後再試。' },
    ])('should reject with message for geolocation error code $code', async ({ code, message }) => {
      stubGeolocation((_s: PositionCallback, err: PositionErrorCallback) => {
        err(mockGeoError(code));
      });
      await expect(service.getCurrentPosition()).rejects.toThrow(message);
    });

    it('should try fast positioning first, then fall back to high accuracy', async () => {
      const spy = stubGeolocation(
        (success: PositionCallback, error: PositionErrorCallback, options?: PositionOptions) => {
          if (options?.enableHighAccuracy) {
            success(mockPosition);
          } else {
            error(mockGeoError(3));
          }
        },
      );

      const result = await service.getCurrentPosition();
      expect(result).toBe(mockPosition);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('should not retry when permission is denied', async () => {
      const spy = stubGeolocation((_s: PositionCallback, err: PositionErrorCallback) => {
        err(mockGeoError(1));
      });

      await expect(service.getCurrentPosition()).rejects.toThrow('定位權限被拒絕');
      expect(spy).toHaveBeenCalledTimes(1);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });
  });

  describe('reverseGeocode', () => {
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
      const result = await flushReverseGeocode(service, httpTesting, 24.859, 121.823, {
        display_name: '中正路100號, 頭城鎮, 宜蘭縣, 臺灣',
        address: { house_number: '100號', road: '中正路', town: '頭城鎮', county: '宜蘭縣' },
      });
      expect(result).toBe('宜蘭縣頭城鎮中正路100號');
    });

    it('should fallback to display_name when address fields are insufficient', async () => {
      const result = await flushReverseGeocode(service, httpTesting, 25.033, 121.565, {
        display_name: '某個地方, 臺灣',
        address: {},
      });
      expect(result).toBe('某個地方, 臺灣');
    });

    it('should throw on HTTP error after retries', async () => {
      await withFakeTimers(async () => {
        const consoleErrorSpy = muteExpectedGeocodingErrors();
        await failReverseGeocodeAfterRetry(
          service,
          httpTesting,
          25.033,
          '地址查詢失敗，請稍後再試。',
        );
        expectGeocodingErrorsLogged(consoleErrorSpy);
      });
    });

    it('should succeed on retry after initial failure', async () => {
      await withFakeTimers(async () => {
        const promise = service.reverseGeocode(25.033, 121.565);
        await flushFailedAttempt(httpTesting);
        expectNominatimRequest(httpTesting).flush(TAIPEI_RESPONSE);

        const result = await promise;
        expect(result).toBe('臺北市');
      });
    });

    it('should throw on request timeout', async () => {
      await withFakeTimers(async () => {
        const consoleErrorSpy = muteExpectedGeocodingErrors();
        const promise = service.reverseGeocode(25.033, 121.565);

        // Attach rejection handler early to prevent unhandled rejection warning.
        const rejection = expect(promise).rejects.toThrow('地址查詢失敗，請稍後再試。');

        expectNominatimRequest(httpTesting);
        await vi.advanceTimersByTimeAsync(8000);
        await vi.advanceTimersByTimeAsync(1000);
        expectNominatimRequest(httpTesting);
        await vi.advanceTimersByTimeAsync(8000);

        await rejection;
        expectGeocodingErrorsLogged(consoleErrorSpy);
      });
    });

    it('should throw when no address and no display_name', async () => {
      await expect(flushReverseGeocode(service, httpTesting, 25.033, 121.565, {})).rejects.toThrow(
        '無法解析地址，請手動輸入。',
      );
    });

    it.each([
      { lat: 91, lon: 121 },
      { lat: -91, lon: 121 },
      { lat: Number.NaN, lon: 121 },
      { lat: 25, lon: 181 },
      { lat: 25, lon: -181 },
      { lat: 25, lon: Infinity },
    ])('should throw on invalid coordinates ($lat, $lon)', async ({ lat, lon }) => {
      await expect(service.reverseGeocode(lat, lon)).rejects.toThrow('無效的座標資訊。');
    });

    it('should return cached result for nearby coordinates', async () => {
      const mockResponse = {
        display_name: '臺北市信義區',
        address: { city: '臺北市', suburb: '信義區' },
      };

      // First call — hits network
      const result1 = await flushReverseGeocode(
        service,
        httpTesting,
        25.03301,
        121.56501,
        mockResponse,
      );
      expect(result1).toBe('臺北市信義區');

      // Second call with nearby coords (same toFixed(4) = 25.0330, 121.5650) — should use cache
      const result2 = await service.reverseGeocode(25.03304, 121.56504);
      httpTesting.expectNone((r) => r.url.includes('nominatim'));
      expect(result2).toBe('臺北市信義區');
    });

    it('should not cache failed requests', async () => {
      await withFakeTimers(async () => {
        const consoleErrorSpy = muteExpectedGeocodingErrors();

        await failReverseGeocodeAfterRetry(service, httpTesting, 25.033);

        const result2 = await flushReverseGeocode(
          service,
          httpTesting,
          25.033,
          121.565,
          TAIPEI_RESPONSE,
        );
        expect(result2).toBe('臺北市');
        expectGeocodingErrorsLogged(consoleErrorSpy);
      });
    });

    it('should include User-Agent header in request', async () => {
      const promise = service.reverseGeocode(25.033, 121.565);
      const req = expectNominatimRequest(httpTesting);
      expect(req.request.headers.get('User-Agent')).toBe('report-via-mobile (https://tools.pylot.dev)');
      req.flush({ display_name: 'test' });
      await promise;
    });

    it('should open circuit after 3 consecutive failures', async () => {
      await withFakeTimers(async () => {
        const consoleErrorSpy = muteExpectedGeocodingErrors();

        await openCircuit(service, httpTesting);

        await expect(service.reverseGeocode(26, 121)).rejects.toThrow(GEOCODE_CIRCUIT_OPEN_MSG);
        httpTesting.expectNone((r) => r.url.includes('nominatim'));
        expectGeocodingErrorsLogged(consoleErrorSpy, 3);
      });
    });

    it('should reject immediately when circuit is open', async () => {
      await withFakeTimers(async () => {
        const consoleErrorSpy = muteExpectedGeocodingErrors();

        await openCircuit(service, httpTesting);

        await expect(service.reverseGeocode(27, 121)).rejects.toThrow(GEOCODE_CIRCUIT_OPEN_MSG);
        await expect(service.reverseGeocode(28, 121)).rejects.toThrow(GEOCODE_CIRCUIT_OPEN_MSG);
        httpTesting.expectNone((r) => r.url.includes('nominatim'));
        expectGeocodingErrorsLogged(consoleErrorSpy, 3);
      });
    });

    it('should allow probe after cooldown (half-open state)', async () => {
      await withFakeTimers(async () => {
        const consoleErrorSpy = muteExpectedGeocodingErrors();

        await openCircuit(service, httpTesting);
        await vi.advanceTimersByTimeAsync(30_000);

        const probePromise = service.reverseGeocode(30, 121);
        const probeReq = expectNominatimRequest(httpTesting);
        probeReq.flush(TAIPEI_RESPONSE);
        const result = await probePromise;
        expect(result).toBe('臺北市');
        expectGeocodingErrorsLogged(consoleErrorSpy, 3);
      });
    });

    it('should reset circuit on success', async () => {
      await withFakeTimers(async () => {
        const consoleErrorSpy = muteExpectedGeocodingErrors();

        for (const lat of [25, 25.01]) {
          await failReverseGeocodeAfterRetry(service, httpTesting, lat);
        }

        const successPromise = service.reverseGeocode(27, 121);
        expectNominatimRequest(httpTesting).flush(TAIPEI_RESPONSE);
        await successPromise;

        for (const lat of [28, 28.01]) {
          await failReverseGeocodeAfterRetry(service, httpTesting, lat);
        }

        const verifyPromise = service.reverseGeocode(31, 121);
        expectNominatimRequest(httpTesting).flush({
          display_name: '高雄市',
          address: { city: '高雄市' },
        });
        const result = await verifyPromise;
        expect(result).toBe('高雄市');
        expectGeocodingErrorsLogged(consoleErrorSpy, 4);
      });
    });

    it('should immediately open circuit on 429 HTTP error', async () => {
      await withFakeTimers(async () => {
        const consoleErrorSpy = muteExpectedGeocodingErrors();
        await failReverseGeocodeAfterRetry(
          service,
          httpTesting,
          25.033,
          GEOCODE_RATE_LIMITED_MSG,
          RATE_LIMIT_ERROR,
        );

        await expect(service.reverseGeocode(26, 121)).rejects.toThrow(GEOCODE_CIRCUIT_OPEN_MSG);
        httpTesting.expectNone((r) => r.url.includes('nominatim'));
        expectGeocodingErrorsLogged(consoleErrorSpy);
      });
    });

    it('should immediately open circuit on 503 HTTP error', async () => {
      await withFakeTimers(async () => {
        const consoleErrorSpy = muteExpectedGeocodingErrors();
        await failReverseGeocodeAfterRetry(
          service,
          httpTesting,
          25.033,
          GEOCODE_SERVICE_UNAVAILABLE_MSG,
          SERVICE_UNAVAILABLE_ERROR,
        );

        await expect(service.reverseGeocode(26, 121)).rejects.toThrow(GEOCODE_CIRCUIT_OPEN_MSG);
        httpTesting.expectNone((r) => r.url.includes('nominatim'));
        expectGeocodingErrorsLogged(consoleErrorSpy);
      });
    });

    it('fallbackToManualInput should reflect circuit state', async () => {
      await withFakeTimers(async () => {
        const consoleErrorSpy = muteExpectedGeocodingErrors();

        expect(service.fallbackToManualInput()).toBe(false);

        await openCircuit(service, httpTesting);

        expect(service.fallbackToManualInput()).toBe(true);

        await vi.advanceTimersByTimeAsync(30_000);

        const probePromise = service.reverseGeocode(30, 121);
        expectNominatimRequest(httpTesting).flush(TAIPEI_RESPONSE);
        await probePromise;

        expect(service.fallbackToManualInput()).toBe(false);
        expectGeocodingErrorsLogged(consoleErrorSpy, 3);
      });
    });

    it('should evict oldest cache entry when cache exceeds max size', async () => {
      // Fill cache to MAX_CACHE_SIZE (100) with unique coords
      for (let i = 0; i < 100; i++) {
        const lat = 20 + i * 0.01;
        const promise = service.reverseGeocode(lat, 121);
        const req = expectNominatimRequest(httpTesting);
        req.flush({ display_name: `地址${i}`, address: { city: `城市${i}` } });
        await promise;
      }

      // Add one more — should evict the first entry (lat=20.0000)
      const promise = service.reverseGeocode(30, 121);
      const req = expectNominatimRequest(httpTesting);
      req.flush({ display_name: '新地址', address: { city: '新城市' } });
      await promise;

      // The first entry should be evicted — request should go to network
      const promise2 = service.reverseGeocode(20, 121);
      const req2 = expectNominatimRequest(httpTesting);
      req2.flush({ display_name: '舊地址', address: { city: '舊城市' } });
      const result = await promise2;
      expect(result).toBe('舊城市');
    });
  });
});
