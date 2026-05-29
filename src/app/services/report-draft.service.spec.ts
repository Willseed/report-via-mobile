import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { POLICE_STATIONS } from '../police-stations';
import { LocationResolverService } from './location-resolver.service';
import { ReportDraftService } from './report-draft.service';
import { ReportFormService } from './report-form.service';

const VALID_ADDRESS = '臺北市信義區信義路五段7號';
const VALID_VIOLATION = '汽車於紅線停車';

describe('ReportDraftService', () => {
  let draft: ReportDraftService;
  let form: ReportFormService;
  let location: {
    clearAddressDebounce: ReturnType<typeof vi.fn>;
    resetLocationState: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    location = {
      clearAddressDebounce: vi.fn(),
      resetLocationState: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: LocationResolverService, useValue: location }],
    });
    draft = TestBed.inject(ReportDraftService);
    form = TestBed.inject(ReportFormService);
  });

  function fillDraft(): void {
    form.setAddress(VALID_ADDRESS);
    form.setSelectedStation(POLICE_STATIONS[0]);
    draft.updateViolation(VALID_VIOLATION);
  }

  it('should expose valid submit data from the lower-level form state', () => {
    fillDraft();
    draft.updateLicensePlate('abc-123!');

    expect(draft.isFormValid()).toBe(true);
    expect(draft.submitData()).toEqual({
      stationName: POLICE_STATIONS[0].stationName,
      phoneNumber: POLICE_STATIONS[0].phoneNumber,
      message: `${VALID_ADDRESS}，有${VALID_VIOLATION}，車牌號碼：ABC123，請派員處理`,
      licensePlate: 'ABC123',
    });
  });

  it('should touch location and violation fields together', () => {
    expect(form.addressForm.address().touched()).toBe(false);
    expect(form.violationForm.violation().touched()).toBe(false);

    draft.touchAllFields();

    expect(form.addressForm.address().touched()).toBe(true);
    expect(form.violationForm.violation().touched()).toBe(true);
    expect(form.violationForm.licensePlate().touched()).toBe(true);
    expect(form.districtRequired()).toBe(true);
  });

  it('should reset the full report draft', () => {
    fillDraft();
    draft.updateLicensePlate('ABC123');

    draft.resetForm();

    expect(form.address()).toBe('');
    expect(form.station()).toBeNull();
    expect(draft.selectedViolation()).toBe('');
    expect(draft.licensePlate()).toBe('');
    expect(draft.smsMessage()).toBe('');
    expect(location.clearAddressDebounce).toHaveBeenCalledOnce();
    expect(location.resetLocationState).toHaveBeenCalledOnce();
  });
});
