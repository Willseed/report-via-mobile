import { Injectable, inject, signal, type Signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
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

    const data: ConfirmDialogData | null = this.draft.submitData();
    if (!data) return;

    const ConfirmDialog = await this.loadConfirmDialog();
    if (!ConfirmDialog) return;

    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialog, { data, width: '92vw', maxWidth: '400px' })
        .afterClosed(),
    );

    if (confirmed) {
      this.smsService.sendSms(data.phoneNumber, data.message);
    }
  }

  private canSubmit(): boolean {
    return this.draft.isFormValid();
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
