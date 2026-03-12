import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  cleanLicensePlate,
  filterViolations,
  LICENSE_PLATE_PATTERN,
} from '../domain/violation.utils';
import { ReportFormService } from './report-form.service';

const REPORT_FORM_PROPERTY_CONFIG = {
  numRuns: 100,
  seed: 90420101,
};

describe('ReportFormService', () => {
  let service: ReportFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReportFormService);
  });

  it('should keep license plate sanitization synced with the form control', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 40 }), (raw) => {
        const cleaned = cleanLicensePlate(raw);
        const returned = service.handleLicensePlateInput(raw);

        expect(returned).toBe(cleaned);
        expect(service.licensePlate()).toBe(cleaned);
        expect(service.violationForm.licensePlate().value()).toBe(cleaned);
        expect(cleanLicensePlate(returned)).toBe(returned);
        expect(returned).toMatch(LICENSE_PLATE_PATTERN);
      }),
      REPORT_FORM_PROPERTY_CONFIG,
    );
  });

  it('should expose the same filtered violation options as the domain helper', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme', maxLength: 20 }), (filter) => {
        service.setViolationFilter(filter);

        expect(service.filteredViolations()).toEqual(filterViolations(filter, service.violationTypes));
      }),
      { ...REPORT_FORM_PROPERTY_CONFIG, seed: 90420102 },
    );
  });
});
