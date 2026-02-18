import { TW_ADDRESS_RULES, type AddressNormalizationRule } from '../i18n/address-normalization';
import { POLICE_STATIONS, type PoliceStation } from './police-stations';

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
  return POLICE_STATIONS.find((station) => normalized.includes(station.district)) ?? null;
}

export function areStationsEqual(
  a: PoliceStation | null,
  b: PoliceStation | null,
): boolean {
  if (!a || !b) return a === b;
  return a.district === b.district && a.phoneNumber === b.phoneNumber;
}
