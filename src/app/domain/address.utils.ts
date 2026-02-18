import { TW_ADDRESS_RULES, type AddressNormalizationRule } from '../i18n/address-normalization';
import { STATION_MAP, type PoliceStation } from './police-stations';

const DISTRICT_MATCHER = new RegExp(
  Array.from(STATION_MAP.keys())
    .sort((a, b) => b.length - a.length)
    .join('|'),
);

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
  const match = normalized.match(DISTRICT_MATCHER);
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
