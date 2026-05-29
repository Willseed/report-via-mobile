import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { District, POLICE_STATIONS, type PoliceStation } from '../police-stations';
import { MessageComposerService } from './message-composer.service';
import { ReportFormService } from './report-form.service';

const VALID_ADDRESS = '臺北市信義區信義路五段7號';
const VALID_VIOLATION = '汽車於紅線停車';

function stationFor(district: District): PoliceStation {
  const station = POLICE_STATIONS.find((candidate) => candidate.district === district);
  if (!station) throw new Error(`Missing station fixture: ${district}`);
  return station;
}

describe('MessageComposerService', () => {
  let composer: MessageComposerService;
  let form: ReportFormService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    composer = TestBed.inject(MessageComposerService);
    form = TestBed.inject(ReportFormService);
  });

  function setLocation(station = stationFor(District.Taipei), address = VALID_ADDRESS): void {
    form.setAddress(address);
    form.setSelectedStation(station);
  }

  it('should keep the message empty for address only', () => {
    setLocation();

    expect(composer.composedMessage()).toBe('');
  });

  it('should keep the message empty for address and violation without a selected station', () => {
    form.setAddress(VALID_ADDRESS);
    form.setViolation(VALID_VIOLATION);

    expect(composer.composedMessage()).toBe('');
    expect(composer.pendingPreview()).toBe(true);
  });

  it('should ignore license plate input until a violation is present', () => {
    setLocation();
    form.setLicensePlate('abc-123');

    expect(composer.composedMessage()).toBe('');
  });

  it('should compose address and violation with Traditional Chinese separators', () => {
    setLocation();
    form.setViolation(VALID_VIOLATION);

    expect(composer.composedMessage()).toBe(
      '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
    );
  });

  it('should compose address, violation, and sanitized license plate with stable separators', () => {
    setLocation();
    form.setViolation(VALID_VIOLATION);
    form.setLicensePlate('abc-123');

    const message = composer.composedMessage();

    expect(message).toBe(
      '臺北市信義區信義路五段7號，有汽車於紅線停車，車牌號碼：ABC123，請派員處理',
    );
    expect(message.split('，')).toEqual([
      VALID_ADDRESS,
      `有${VALID_VIOLATION}`,
      '車牌號碼：ABC123',
      '請派員處理',
    ]);
  });

  it('should compose unknown violation values as plain text', () => {
    const customViolation = '路口車輛違規停放';
    setLocation();
    form.setViolation(customViolation);

    const message = composer.composedMessage();

    expect(form.violationTypes).not.toContain(customViolation);
    expect(message).toBe(`臺北市信義區信義路五段7號，有${customViolation}，請派員處理`);
    expect(message).not.toMatch(/[<>]/);
  });

  it('should detect district mismatch only when selected district differs from the address', () => {
    setLocation(stationFor(District.Kaohsiung));

    expect(composer.stationFromAddress()?.district).toBe(District.Taipei);
    expect(composer.districtMismatch()).toBe(true);

    form.setSelectedStation(stationFor(District.Taipei));

    expect(composer.districtMismatch()).toBe(false);
  });

  it('should not mark a mismatch when the address has no recognizable district', () => {
    setLocation(stationFor(District.Kaohsiung), '國道服務區停車場');

    expect(composer.stationFromAddress()).toBeNull();
    expect(composer.districtMismatch()).toBe(false);
  });
});
