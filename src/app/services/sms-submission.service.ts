import { Injectable, inject, signal, type Signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ZH_TW } from '../i18n';
import { SmsService } from '../sms.service';
import type { ConfirmDialogData } from '../sms-form/confirm-dialog';
import { ReportStateService } from './report-state.service';

type ConfirmDialogComponent = typeof import('../sms-form/confirm-dialog').ConfirmDialog;

@Injectable({ providedIn: 'root' })
export class SmsSubmissionService {
  private readonly smsService = inject(SmsService);
  private readonly dialog = inject(MatDialog);
  private readonly state = inject(ReportStateService);

  readonly isDesktop: Signal<boolean> = signal(this.smsService.isDesktop()).asReadonly();

  async submit(): Promise<void> {
    if (!this.canSubmit()) {
      this.markFormsAsTouched();
      return;
    }

    const station = this.state.station();
    if (!station) return;

    const data: ConfirmDialogData = {
      stationName: station.stationName,
      phoneNumber: station.phoneNumber,
      message: this.state.composedMessage(),
      licensePlate: this.state.licensePlate() || undefined,
    };

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
    return (
      this.state.locationValid() &&
      this.state.violationFormValid() &&
      !this.state.districtMismatch()
    );
  }

  private markFormsAsTouched(): void {
    this.state.markLocationTouched();
    this.state.markViolationTouched();
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
