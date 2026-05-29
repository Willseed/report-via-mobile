import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ZH_TW } from '../i18n';
import { LocationInput } from './location-input/location-input';
import { ViolationInput } from './violation-input/violation-input';
import { SmsPreview } from './sms-preview/sms-preview';
import { ReportDraftService } from '../services/report-draft.service';
import { SmsSubmissionService } from '../services/sms-submission.service';

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
  private readonly draft = inject(ReportDraftService);
  private readonly submission = inject(SmsSubmissionService);
  protected readonly i18n = ZH_TW;

  protected readonly isDesktop = this.submission.isDesktop;
  protected readonly composedMessage = this.draft.smsMessage;
  protected readonly pendingPreview = this.draft.pendingPreview;
  protected readonly districtMismatch = this.draft.hasDistrictMismatch;

  protected sendSms(): Promise<void> {
    return this.submission.submit();
  }
}
