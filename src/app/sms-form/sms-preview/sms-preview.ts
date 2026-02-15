import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

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

  protected readonly SMS_CHAR_LIMIT = SMS_CHAR_LIMIT;

  protected overLimit = computed(() => this.message().length > SMS_CHAR_LIMIT);
}
