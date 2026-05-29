import { signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POLICE_STATIONS } from '../police-stations';
import { SmsService } from '../sms.service';
import { ConfirmDialog, type ConfirmDialogData } from '../sms-form/confirm-dialog';
import { ReportDraftService } from './report-draft.service';
import { SmsSubmissionService } from './sms-submission.service';

const VALID_MESSAGE = '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理';
const VALID_PLATE = 'ABC1234';

interface DraftStubOptions {
  isFormValid?: boolean;
  submitData?: ConfirmDialogData | null;
  licensePlate?: string;
  message?: string;
}

interface DraftStub {
  readonly isFormValid: Signal<boolean>;
  readonly submitData: Signal<ConfirmDialogData | null>;
  readonly touchAllFields: ReturnType<typeof vi.fn>;
}

function createDraftStub({
  isFormValid = true,
  submitData,
  licensePlate = '',
  message = VALID_MESSAGE,
}: DraftStubOptions = {}): DraftStub {
  return {
    isFormValid: signal(isFormValid).asReadonly(),
    submitData: signal(
      submitData === undefined
        ? {
            stationName: POLICE_STATIONS[0].stationName,
            phoneNumber: POLICE_STATIONS[0].phoneNumber,
            message,
            licensePlate: licensePlate || undefined,
          }
        : submitData,
    ).asReadonly(),
    touchAllFields: vi.fn(),
  };
}

function dialogRefWithResult(result: boolean | undefined): Partial<MatDialogRef<unknown>> {
  return {
    afterClosed: () => of(result),
  };
}

describe('SmsSubmissionService', () => {
  let draft: DraftStub;
  let smsServiceSpy: {
    sendSms: ReturnType<typeof vi.fn>;
    isDesktop: ReturnType<typeof vi.fn>;
  };
  let dialogSpy: { open: ReturnType<typeof vi.fn> };

  function setup(
    draftOptions: DraftStubOptions = {},
    dialogResult?: boolean,
    isDesktop = false,
  ): SmsSubmissionService {
    const resolvedDialogResult = arguments.length >= 2 ? dialogResult : true;
    TestBed.resetTestingModule();
    draft = createDraftStub(draftOptions);
    smsServiceSpy = {
      sendSms: vi.fn(),
      isDesktop: vi.fn().mockReturnValue(isDesktop),
    };
    dialogSpy = {
      open: vi.fn().mockReturnValue(dialogRefWithResult(resolvedDialogResult)),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: ReportDraftService, useValue: draft },
        { provide: SmsService, useValue: smsServiceSpy },
        { provide: MatDialog, useValue: dialogSpy },
      ],
    });

    return TestBed.inject(SmsSubmissionService);
  }

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should open confirmation dialog and send SMS after confirmation', async () => {
    const service = setup();

    await service.submit();

    expect(dialogSpy.open).toHaveBeenCalledWith(ConfirmDialog, {
      data: {
        stationName: POLICE_STATIONS[0].stationName,
        phoneNumber: POLICE_STATIONS[0].phoneNumber,
        message: VALID_MESSAGE,
        licensePlate: undefined,
      },
      width: '92vw',
      maxWidth: '400px',
    });
    expect(smsServiceSpy.sendSms).toHaveBeenCalledWith(
      POLICE_STATIONS[0].phoneNumber,
      VALID_MESSAGE,
    );
  });

  it.each([
    { name: 'cancelled', result: false },
    { name: 'dismissed', result: undefined },
  ])('should not send SMS when dialog is $name', async ({ result }) => {
    const service = setup({}, result);

    await service.submit();

    expect(dialogSpy.open).toHaveBeenCalled();
    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should mark forms as touched and skip dialog when form is invalid', async () => {
    const service = setup({ isFormValid: false });

    await service.submit();

    expect(draft.touchAllFields).toHaveBeenCalled();
    expect(dialogSpy.open).not.toHaveBeenCalled();
    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should mark forms as touched and skip dialog when district mismatches', async () => {
    const service = setup({ isFormValid: false });

    await service.submit();

    expect(draft.touchAllFields).toHaveBeenCalled();
    expect(dialogSpy.open).not.toHaveBeenCalled();
  });

  it('should skip dialog when submit data is unavailable', async () => {
    const service = setup({ submitData: null });

    await service.submit();

    expect(draft.touchAllFields).not.toHaveBeenCalled();
    expect(dialogSpy.open).not.toHaveBeenCalled();
    expect(smsServiceSpy.sendSms).not.toHaveBeenCalled();
  });

  it('should pass license plate to confirmation dialog when present', async () => {
    const service = setup({ licensePlate: VALID_PLATE });

    await service.submit();

    expect(dialogSpy.open).toHaveBeenCalledWith(
      ConfirmDialog,
      expect.objectContaining({
        data: expect.objectContaining({
          licensePlate: VALID_PLATE,
        }),
      }),
    );
  });

  it('should expose desktop state from SmsService', () => {
    const service = setup({}, true, true);

    expect(service.isDesktop()).toBe(true);
    expect(smsServiceSpy.isDesktop).toHaveBeenCalled();
  });
});
