import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { GeocodingService } from '../geocoding.service';
import { District, POLICE_STATIONS } from '../police-stations';
import { LocationWorkflowService } from './location-workflow.service';
import { ReportFormService } from './report-form.service';

describe('LocationWorkflowService', () => {
  let workflow: LocationWorkflowService;
  let form: ReportFormService;
  let geocoding: {
    getCurrentPosition: ReturnType<typeof vi.fn>;
    reverseGeocode: ReturnType<typeof vi.fn>;
    fallbackToManualInput: ReturnType<typeof signal<boolean>>;
  };

  beforeEach(() => {
    geocoding = {
      getCurrentPosition: vi.fn(),
      reverseGeocode: vi.fn(),
      fallbackToManualInput: signal(false),
    };

    TestBed.configureTestingModule({
      providers: [{ provide: GeocodingService, useValue: geocoding }],
    });
    workflow = TestBed.inject(LocationWorkflowService);
    form = TestBed.inject(ReportFormService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should update typed address and auto-select the station', () => {
    workflow.updateAddress('臺北市信義區信義路');

    expect(workflow.address()).toBe('臺北市信義區信義路');
    expect(workflow.station()?.district).toBe(District.Taipei);
  });

  it('should normalize manual addresses immediately', () => {
    workflow.updateManualAddress('台灣臺中市西屯區某路');

    expect(workflow.address()).toBe('臺中市西屯區某路');
    expect(workflow.currentDistrict()).toBe(District.Taichung);
    expect(workflow.effectiveDistrict()).toBe(District.Taichung);
    expect(workflow.displayStation()?.district).toBe(District.Taichung);
  });

  it('should clear location form and resolver state', async () => {
    geocoding.getCurrentPosition.mockRejectedValue(new Error('定位權限被拒絕'));

    await workflow.locateUser();
    expect(workflow.locationError()).toBe('定位權限被拒絕');

    form.setSelectedStation(POLICE_STATIONS[0]);
    workflow.clearLocation();

    expect(workflow.address()).toBe('');
    expect(workflow.station()).toBeNull();
    expect(workflow.locationError()).toBe('');
    expect(workflow.locationStatus()).toBe('');
  });

  it('should expose manual input fallback from the resolver', () => {
    expect(workflow.isManualAddress()).toBe(false);

    geocoding.fallbackToManualInput.set(true);

    expect(workflow.isManualAddress()).toBe(true);
  });
});
