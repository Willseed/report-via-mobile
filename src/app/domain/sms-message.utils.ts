import { ZH_TW } from '../i18n';

export interface SmsMessageInput {
  readonly address: string;
  readonly violation: string;
  readonly licensePlate?: string;
  readonly licensePlates?: readonly string[];
}

export function composeSmsMessage({
  address,
  violation,
  licensePlate = '',
  licensePlates,
}: SmsMessageInput): string {
  const plates = licensePlates ?? (licensePlate ? [licensePlate] : []);
  const plateSegment = plates.length ? `${ZH_TW.smsMessage.platePrefix}${plates.join('、')}` : '';

  return ZH_TW.smsMessage.template
    .replace('{address}', address)
    .replace('{violation}', violation)
    .replace('{plateSegment}', plateSegment);
}
