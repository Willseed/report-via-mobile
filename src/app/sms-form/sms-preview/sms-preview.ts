import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { ZH_TW } from '../../i18n';

export const SMS_CHAR_LIMIT = 70;

@Component({
  selector: 'app-sms-preview',
  imports: [MatIconModule],
  templateUrl: './sms-preview.html',
  styleUrl: './sms-preview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmsPreview {
  readonly message = input.required<string>();
  protected readonly i18n = ZH_TW;

  protected readonly SMS_CHAR_LIMIT = SMS_CHAR_LIMIT;

  protected readonly overLimit = computed(() => this.message().length > SMS_CHAR_LIMIT);
}
