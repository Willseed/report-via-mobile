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

  const replacements: Record<string, string> = {
    '{address}': address,
    '{violation}': violation,
    '{plateSegment}': plateSegment,
  };

  // Match the original template once; callback results stay literal and are never re-parsed.
  return ZH_TW.smsMessage.template.replace(
    /\{(?:address|violation|plateSegment)\}/g,
    (placeholder) => replacements[placeholder] ?? placeholder,
  );
}
