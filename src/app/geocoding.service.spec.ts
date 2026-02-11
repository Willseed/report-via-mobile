import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GeocodingService } from './geocoding.service';

describe('GeocodingService', () => {
  let service: GeocodingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeocodingService);
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
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return display_name on success', async () => {
      const mockResponse = { display_name: '臺北市信義區信義路五段7號' };
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await service.reverseGeocode(25.033, 121.565);
      expect(result).toBe('臺北市信義區信義路五段7號');
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('lat=25.033'),
        expect.any(Object),
      );
    });

    it('should throw on non-ok response', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
      } as Response);

      await expect(service.reverseGeocode(25.033, 121.565)).rejects.toThrow('反向地理編碼失敗');
    });

    it('should return empty string when display_name is missing', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response);

      const result = await service.reverseGeocode(25.033, 121.565);
      expect(result).toBe('');
    });
  });
});
