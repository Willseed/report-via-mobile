import { TestBed } from '@angular/core/testing';
import { describe, it, expect } from 'vitest';
import {
  normalizeAddress,
  findStationByAddress,
  StationLookupService,
  District,
  POLICE_STATIONS,
} from './police-stations';
import type { AddressNormalizationRule } from './i18n/address-normalization';

describe('normalizeAddress', () => {
  it('should replace 台 with 臺 using default rules', () => {
    expect(normalizeAddress('台北市信義區')).toBe('臺北市信義區');
  });

  it('should strip leading postal codes', () => {
    expect(normalizeAddress('110 臺北市信義區')).toBe('臺北市信義區');
  });

  it('should strip country names (台灣, 中華民國, Taiwan, ROC)', () => {
    expect(normalizeAddress('台灣台北市')).toBe('臺北市');
    expect(normalizeAddress('中華民國臺北市')).toBe('臺北市');
    expect(normalizeAddress('Taiwan臺北市')).toBe('臺北市');
    expect(normalizeAddress('ROC臺北市')).toBe('臺北市');
  });

  it('should trim whitespace from result', () => {
    expect(normalizeAddress('  臺北市  ')).toBe('臺北市');
  });

  it('should apply custom rules when provided', () => {
    const customRules: AddressNormalizationRule[] = [
      { pattern: /foo/g, replacement: 'bar' },
    ];
    expect(normalizeAddress('foo123', customRules)).toBe('bar123');
  });

  it('should return empty string for empty input with default rules', () => {
    expect(normalizeAddress('')).toBe('');
  });
});

describe('findStationByAddress', () => {
  it('should find station by district name in address', () => {
    const result = findStationByAddress('臺北市信義區信義路五段7號');
    expect(result).not.toBeNull();
    expect(result!.district).toBe(District.Taipei);
    expect(result!.stationName).toBe('臺北市政府警察局');
  });

  it('should normalize 台 to 臺 and match', () => {
    const result = findStationByAddress('台中市西區');
    expect(result).not.toBeNull();
    expect(result!.district).toBe(District.Taichung);
  });

  it('should return null for unrecognized address', () => {
    expect(findStationByAddress('東京都渋谷区')).toBeNull();
  });

  it('should match all defined districts', () => {
    for (const station of POLICE_STATIONS) {
      const result = findStationByAddress(station.district + '某路100號');
      expect(result).not.toBeNull();
      expect(result!.district).toBe(station.district);
    }
  });

  it('should strip postal code before matching', () => {
    const result = findStationByAddress('110 臺北市信義區');
    expect(result).not.toBeNull();
    expect(result!.district).toBe(District.Taipei);
  });
});

describe('StationLookupService', () => {
  let service: StationLookupService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StationLookupService);
  });

  it('should find a station by address', () => {
    const result = service.findStation('臺北市信義區信義路五段7號');
    expect(result).not.toBeNull();
    expect(result!.district).toBe(District.Taipei);
  });

  it('should return cached result for same input', () => {
    const result1 = service.findStation('臺北市信義區信義路五段7號');
    const result2 = service.findStation('臺北市信義區信義路五段7號');
    expect(result1).toBe(result2); // same reference — memoized
  });

  it('should update cache when input changes', () => {
    const result1 = service.findStation('臺北市信義區');
    expect(result1!.district).toBe(District.Taipei);

    const result2 = service.findStation('高雄市前鎮區');
    expect(result2!.district).toBe(District.Kaohsiung);
  });

  it('should cache null result for unrecognized address', () => {
    const result1 = service.findStation('unknown');
    expect(result1).toBeNull();

    const result2 = service.findStation('unknown');
    expect(result2).toBeNull();
    expect(result1).toBe(result2); // both null, referentially same
  });
});
