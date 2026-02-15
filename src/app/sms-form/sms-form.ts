import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { SmsService } from '../sms.service';
import { PoliceStation } from '../police-stations';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';
import { LocationInput } from './location-input/location-input';
import { ViolationInput } from './violation-input/violation-input';
import { SmsPreview } from './sms-preview/sms-preview';

export { DISTRICT_SEARCH_DEBOUNCE_MS, ADDRESS_MAX_LENGTH } from './location-input/location-input';
export { VIOLATION_MAX_LENGTH, LICENSE_PLATE_MAX_LENGTH, LICENSE_PLATE_PATTERN } from './violation-input/violation-input';

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

  private locationInput = viewChild(LocationInput);
  private violationInput = viewChild(ViolationInput);

  protected isDesktop = signal(this.smsService.isDesktop());

  protected address = signal('');
  protected district = signal<PoliceStation | null>(null);
  protected violation = signal('');
  protected licensePlate = signal('');

  protected districtMismatch = computed(() => {
    return this.locationInput()?.districtMismatch() ?? false;
  });

  protected composedMessage = computed(() => {
    const address = this.address();
    const violation = this.violation();
    const plate = this.licensePlate();
    if (!address || !violation) return '';
    const plateSegment = plate ? `，車牌號碼：${plate}` : '';
    return `${address}，有${violation}${plateSegment}，請派員處理`;
  });

  protected async sendSms(): Promise<void> {
    const location = this.locationInput();
    const violationComp = this.violationInput();

    if (!location?.valid || !violationComp?.valid || this.districtMismatch()) {
      location?.markAsTouched();
      violationComp?.markAsTouched();
      return;
    }

    const station = this.district();
    if (!station) return;

    const data: ConfirmDialogData = {
      stationName: station.stationName,
      phoneNumber: station.phoneNumber,
      message: this.composedMessage(),
      licensePlate: this.licensePlate() || undefined,
    };

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
