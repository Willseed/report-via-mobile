import { TW_ADDRESS_RULES, type AddressNormalizationRule } from '../i18n/address-normalization';
import { STATION_MAP, type PoliceStation } from './police-stations';

const DISTRICT_MATCHER =
  /臺[北中南]市|新北市|桃園市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|澎湖縣|金門縣|連江縣/;

export const ADDRESS_MAX_LENGTH = 100;

export function normalizeAddress(
  raw: string,
  rules: readonly AddressNormalizationRule[] = TW_ADDRESS_RULES,
): string {
  let result = raw;
  for (const rule of rules) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  return result.trim();
}

export function findStationByAddress(address: string): PoliceStation | null {
  const normalized = normalizeAddress(address);
  const match = DISTRICT_MATCHER.exec(normalized);
  if (!match) return null;
  return STATION_MAP.get(match[0] as PoliceStation['district']) ?? null;
}

export function areStationsEqual(
  a: PoliceStation | null,
  b: PoliceStation | null,
): boolean {
  if (!a || !b) return a === b;
  return a.district === b.district && a.phoneNumber === b.phoneNumber;
}
