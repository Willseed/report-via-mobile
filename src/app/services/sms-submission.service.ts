import { Injectable, inject, signal, type Signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ZH_TW } from '../i18n';
import { SmsService } from '../sms.service';
import type { ConfirmDialogData } from '../sms-form/confirm-dialog';
import { ReportDraftService } from './report-draft.service';

type ConfirmDialogComponent = typeof import('../sms-form/confirm-dialog').ConfirmDialog;

@Injectable({ providedIn: 'root' })
export class SmsSubmissionService {
  private readonly smsService = inject(SmsService);
  private readonly dialog = inject(MatDialog);
  private readonly draft = inject(ReportDraftService);

  readonly isDesktop: Signal<boolean> = signal(this.smsService.isDesktop()).asReadonly();

  async submit(): Promise<void> {
    if (!this.canSubmit()) {
      this.draft.touchAllFields();
      return;
    }

    const data = this.draft.submitData();
    if (!data) return;

    const snapshot: ConfirmDialogData = {
      ...data,
      warnings: [...ZH_TW.webmcp.previewWarnings],
    };
    if (!(await this.confirmDraft(snapshot))) return;

    const current = this.draft.submitData();
    if (!this.draft.isFormValid() || !current || !this.sameDraft(data, current)) return;
    this.smsService.sendSms(snapshot.phoneNumber, snapshot.message);
  }

  async confirmDraft(data: ConfirmDialogData): Promise<boolean> {
    const ConfirmDialog = await this.loadConfirmDialog();
    if (!ConfirmDialog) return false;

    return (await new Promise<boolean | undefined>((resolve) => {
      this.dialog
        .open(ConfirmDialog, { data, width: '92vw', maxWidth: '400px' })
        .afterClosed()
        .subscribe({
          next: resolve,
          error: () => resolve(undefined),
          complete: () => resolve(undefined),
        });
    })) === true;
  }

  private canSubmit(): boolean {
    return this.draft.isFormValid();
  }

  private sameDraft(a: ConfirmDialogData, b: ConfirmDialogData): boolean {
    return (
      a.stationName === b.stationName &&
      a.phoneNumber === b.phoneNumber &&
      a.message === b.message &&
      a.licensePlate === b.licensePlate
    );
  }

  private async loadConfirmDialog(): Promise<ConfirmDialogComponent | null> {
    try {
      return (await import('../sms-form/confirm-dialog')).ConfirmDialog;
    } catch {
      globalThis.alert(ZH_TW.smsForm.chunkLoadError);
      return null;
    }
  }
}
