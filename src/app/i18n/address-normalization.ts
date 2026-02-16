export interface AddressNormalizationRule {
  pattern: RegExp;
  replacement: string;
}

export const TW_ADDRESS_RULES: readonly AddressNormalizationRule[] = [
  { pattern: /台灣|中華民國|Taiwan|ROC/gi, replacement: '' },
  { pattern: /^\d{3,5}\s*/, replacement: '' },
  { pattern: /台/g, replacement: '臺' },
];
