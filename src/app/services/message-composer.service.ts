import { Injectable, computed, inject } from '@angular/core';
import { ZH_TW } from '../i18n';
import { StationLookupService } from '../police-stations';
import { ReportFormService } from './report-form.service';

@Injectable({ providedIn: 'root' })
export class MessageComposerService {
  private readonly formService = inject(ReportFormService);
  private readonly stationLookup = inject(StationLookupService);

  readonly stationFromAddress = computed(() =>
    this.stationLookup.findStation(this.formService.address()),
  );

  readonly districtMismatch = computed(() => {
    const selected = this.formService.station();
    const matched = this.stationFromAddress();
    if (!selected || !matched) return false;
    return selected.district !== matched.district;
  });

  readonly pendingPreview = computed(() => {
    const address = this.formService.address();
    const violation = this.formService.violation();
    const station = this.formService.station();
    return (!!address || !!violation) && !station;
  });

  readonly composedMessage = computed(() => {
    const address = this.formService.address();
    const violation = this.formService.violation();
    const station = this.formService.station();
    if (!address || !violation || !station) return '';
    const licensePlate = this.formService.licensePlate();
    const plateSegment = licensePlate ? `${ZH_TW.smsMessage.platePrefix}${licensePlate}` : '';
    return `${address}，有${violation}${plateSegment}，請派員處理`;
  });
}
