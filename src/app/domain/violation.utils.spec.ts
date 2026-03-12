import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  cleanLicensePlate,
  filterViolations,
  LICENSE_PLATE_PATTERN,
  VIOLATION_TYPES,
} from './violation.utils';

const VIOLATION_PROPERTY_CONFIG = {
  numRuns: 100,
  seed: 0x7101a710,
};

describe('violation.utils', () => {
  describe('cleanLicensePlate', () => {
    it('should preserve the core license-plate invariants', () => {
      fc.assert(
        fc.property(fc.string({ unit: 'grapheme', maxLength: 40 }), (raw) => {
          const cleaned = cleanLicensePlate(raw);

          expect(cleaned).toMatch(LICENSE_PLATE_PATTERN);
          expect(cleanLicensePlate(cleaned)).toBe(cleaned);
          expect(cleaned.length).toBeLessThanOrEqual(raw.length);
        }),
        VIOLATION_PROPERTY_CONFIG,
      );
    });
  });

  describe('filterViolations', () => {
    it('should always return entries from the provided source list', () => {
      fc.assert(
        fc.property(fc.string({ unit: 'grapheme', maxLength: 20 }), (filter) => {
          const result = filterViolations(filter, VIOLATION_TYPES);

          expect(result.every((violation) => VIOLATION_TYPES.includes(violation))).toBe(true);
          if (filter && !VIOLATION_TYPES.includes(filter)) {
            expect(result.every((violation) => violation.includes(filter))).toBe(true);
          }
        }),
        VIOLATION_PROPERTY_CONFIG,
      );
    });

    it('should keep empty and exact-match filters on the full list', () => {
      expect(filterViolations('', VIOLATION_TYPES)).toBe(VIOLATION_TYPES);

      fc.assert(
        fc.property(fc.constantFrom(...VIOLATION_TYPES), (filter) => {
          expect(filterViolations(filter, VIOLATION_TYPES)).toBe(VIOLATION_TYPES);
        }),
        { ...VIOLATION_PROPERTY_CONFIG, seed: 0x7101a711 },
      );
    });
  });
});
