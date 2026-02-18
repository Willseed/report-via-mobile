import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { SmsService } from '../sms.service';
import { ZH_TW } from '../i18n';
import type { ConfirmDialogData } from './confirm-dialog';
import { LocationInput } from './location-input/location-input';
import { ViolationInput } from './violation-input/violation-input';
import { SmsPreview } from './sms-preview/sms-preview';
import { ReportStateService } from '../report-state.service';

export { DISTRICT_SEARCH_DEBOUNCE_MS } from './location-input/location-input';
export {
  VIOLATION_MAX_LENGTH,
  LICENSE_PLATE_MAX_LENGTH,
  LICENSE_PLATE_PATTERN,
} from './violation-input/violation-input';

@Component({
  selector: 'app-sms-form',
  imports: [MatButtonModule, MatIconModule, LocationInput, ViolationInput, SmsPreview],
  templateUrl: './sms-form.html',
  styleUrl: './sms-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmsForm {
  private smsService = inject(SmsService);
  private dialog = inject(MatDialog);
  private state = inject(ReportStateService);
  protected readonly i18n = ZH_TW;

  private locationInput = viewChild(LocationInput);
  private violationInput = viewChild(ViolationInput);

  protected isDesktop = signal(this.smsService.isDesktop());
  protected composedMessage = this.state.composedMessage;
  protected pendingPreview = this.state.pendingPreview;
  protected districtMismatch = this.state.districtMismatch;

  protected async sendSms(): Promise<void> {
    const location = this.locationInput();
    const violationComp = this.violationInput();

    if (!location?.valid() || !violationComp?.valid() || this.districtMismatch()) {
      location?.markAsTouched();
      violationComp?.markAsTouched();
      return;
    }

    const station = this.state.station();
    if (!station) return;

    const data: ConfirmDialogData = {
      stationName: station.stationName,
      phoneNumber: station.phoneNumber,
      message: this.composedMessage(),
      licensePlate: this.state.licensePlate() || undefined,
    };

    let ConfirmDialog;
    try {
      ({ ConfirmDialog } = await import('./confirm-dialog'));
    } catch {
      alert(ZH_TW.smsForm.chunkLoadError);
      return;
    }
    const confirmed = await firstValueFrom(
      this.dialog
        .open(ConfirmDialog, { data, width: '92vw', maxWidth: '400px' })
        .afterClosed(),
    );
    if (confirmed) {
      this.smsService.sendSms(data.phoneNumber, data.message);
    }
  }
}
