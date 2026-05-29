import { ZH_TW } from '../i18n';

export interface SmsMessageInput {
  readonly address: string;
  readonly violation: string;
  readonly licensePlate?: string;
}

export function composeSmsMessage({
  address,
  violation,
  licensePlate = '',
}: SmsMessageInput): string {
  const plateSegment = licensePlate ? `${ZH_TW.smsMessage.platePrefix}${licensePlate}` : '';

  return ZH_TW.smsMessage.template
    .replace('{address}', address)
    .replace('{violation}', violation)
    .replace('{plateSegment}', plateSegment);
}
