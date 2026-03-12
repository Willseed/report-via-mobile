import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  normalizeAddress,
  findStationByAddress,
  StationLookupService,
  District,
  POLICE_STATIONS,
} from './police-stations';
import type { AddressNormalizationRule } from './i18n/address-normalization';

const ADDRESS_PROPERTY_CONFIG = {
  numRuns: 100,
  seed: 44055101,
};

const COUNTRY_ALIASES = ['台灣', '中華民國', 'Taiwan', 'ROC'] as const;

function buildVariantAddress(
  district: District,
  alias: (typeof COUNTRY_ALIASES)[number],
  postalCode: number,
): string {
  const districtVariant = district.replaceAll('臺', '台');
  return `${String(postalCode).padStart(3, '0')} ${alias}${districtVariant}某路100號`;
}

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

  it('should remain idempotent under repeated normalization', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 60 }), (raw) => {
        const normalized = normalizeAddress(raw);
        expect(normalizeAddress(normalized)).toBe(normalized);
      }),
      ADDRESS_PROPERTY_CONFIG,
    );
  });

  it('should trim postal-code and country-prefix variants consistently', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...POLICE_STATIONS.map((station) => station.district)),
        fc.constantFrom(...COUNTRY_ALIASES),
        fc.integer({ min: 0, max: 99999 }),
        (district, alias, postalCode) => {
          expect(normalizeAddress(buildVariantAddress(district, alias, postalCode))).toBe(
            `${district}某路100號`,
          );
        },
      ),
      { ...ADDRESS_PROPERTY_CONFIG, seed: 44055102 },
    );
  });
});

describe('findStationByAddress', () => {
  it('should find station by district name in address', () => {
    const result = findStationByAddress('臺北市信義區信義路五段7號');
    expect(result).toBeDefined();
    expect(result?.district).toBe(District.Taipei);
    expect(result?.stationName).toBe('臺北市政府警察局');
  });

  it('should normalize 台 to 臺 and match', () => {
    const result = findStationByAddress('台中市西區');
    expect(result).toBeDefined();
    expect(result?.district).toBe(District.Taichung);
  });

  it('should return null for unrecognized address', () => {
    expect(findStationByAddress('東京都渋谷区')).toBeNull();
  });

  it('should match all defined districts', () => {
    for (const station of POLICE_STATIONS) {
      const result = findStationByAddress(station.district + '某路100號');
      expect(result).toBeDefined();
      expect(result?.district).toBe(station.district);
    }
  });

  it('should strip postal code before matching', () => {
    const result = findStationByAddress('110 臺北市信義區');
    expect(result).toBeDefined();
    expect(result?.district).toBe(District.Taipei);
  });

  it('should resolve normalized address variants to the same station', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...POLICE_STATIONS),
        fc.constantFrom(...COUNTRY_ALIASES),
        fc.integer({ min: 0, max: 99999 }),
        (station, alias, postalCode) => {
          expect(findStationByAddress(buildVariantAddress(station.district, alias, postalCode))).toBe(
            station,
          );
        },
      ),
      { ...ADDRESS_PROPERTY_CONFIG, seed: 44055103 },
    );
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
    expect(result).toBeDefined();
    expect(result?.district).toBe(District.Taipei);
  });

  it('should return cached result for same input', () => {
    const result1 = service.findStation('臺北市信義區信義路五段7號');
    const result2 = service.findStation('臺北市信義區信義路五段7號');
    expect(result1).toBe(result2); // same reference — memoized
  });

  it('should update cache when input changes', () => {
    const result1 = service.findStation('臺北市信義區');
    expect(result1?.district).toBe(District.Taipei);

    const result2 = service.findStation('高雄市前鎮區');
    expect(result2?.district).toBe(District.Kaohsiung);
  });

  it('should cache null result for unrecognized address', () => {
    const result1 = service.findStation('unknown');
    expect(result1).toBeNull();

    const result2 = service.findStation('unknown');
    expect(result2).toBeNull();
    expect(result1).toBe(result2); // both null, referentially same
  });

  it('should memoize successful lookups for repeated normalized variants', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...POLICE_STATIONS),
        fc.constantFrom(...COUNTRY_ALIASES),
        fc.integer({ min: 0, max: 99999 }),
        (station, alias, postalCode) => {
          const address = buildVariantAddress(station.district, alias, postalCode);

          const first = service.findStation(address);
          const second = service.findStation(address);

          expect(first).toBe(station);
          expect(second).toBe(first);
        },
      ),
      { ...ADDRESS_PROPERTY_CONFIG, seed: 44055104 },
    );
  });

  it('should memoize null lookups for repeated unknown inputs', () => {
    fc.assert(
      fc.property(fc.uuid(), (unknownAddress) => {
        const first = service.findStation(unknownAddress);
        const second = service.findStation(unknownAddress);

        expect(first).toBeNull();
        expect(second).toBe(first);
      }),
      { ...ADDRESS_PROPERTY_CONFIG, seed: 44055105 },
    );
  });
});
