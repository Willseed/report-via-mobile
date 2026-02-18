const VEHICLE_TYPES = ['汽車', '機車'] as const;
const VIOLATION_DESCRIPTIONS = [
  '於紅線停車',
  '於黃線停車',
  '於騎樓停車',
  '於人行道停車',
  '並排停車',
  '於轉彎處停車',
  '佔用車道影響交通',
];

const CAR_ONLY_DESCRIPTIONS = [
  '違法佔用孕婦及育有六歲以下兒童者停車位',
  '違法佔用身心障礙者專用停車位',
  '佔用機車停車位',
];

const OTHER_VIOLATIONS = [
  '一般油車佔用電動車停車位',
  '雜物佔用國有地',
  '攤販於騎樓違法擺攤',
  '慢車未依規定停放',
  '物品堆置於道路（含騎樓、人行道）妨礙交通',
];

export const VIOLATION_TYPES = [
  ...VEHICLE_TYPES.flatMap((vehicle) => VIOLATION_DESCRIPTIONS.map((d) => `${vehicle}${d}`)),
  ...CAR_ONLY_DESCRIPTIONS.map((d) => `汽車${d}`),
  ...OTHER_VIOLATIONS,
];

export const VIOLATION_MAX_LENGTH = 50;
export const LICENSE_PLATE_MAX_LENGTH = 10;
export const LICENSE_PLATE_PATTERN = /^[A-Z0-9]*$/;

export function filterViolations(
  filter: string,
  types: readonly string[] = VIOLATION_TYPES,
): readonly string[] {
  if (!filter || types.includes(filter)) return types;
  return types.filter((type) => type.includes(filter));
}

export function cleanLicensePlate(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
