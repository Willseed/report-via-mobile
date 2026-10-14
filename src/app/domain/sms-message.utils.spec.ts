import { afterEach, describe, expect, it } from 'vitest';
import { ZH_TW } from '../i18n';
import { composeSmsMessage, type SmsMessageInput } from './sms-message.utils';

const ADDRESS = '臺北市信義區信義路五段7號';
const VIOLATION = '汽車於紅線停車';
const PLATE = 'ABC-1234';

describe('composeSmsMessage', () => {
  it('preserves the normal message format with a license plate', () => {
    expect(
      composeSmsMessage({ address: ADDRESS, violation: VIOLATION, licensePlate: PLATE }),
    ).toBe('臺北市信義區信義路五段7號，有汽車於紅線停車，車牌號碼：ABC-1234，請派員處理');
  });

  it.each([undefined, ''])('omits the plate segment for licensePlate=%j', (licensePlate) => {
    expect(composeSmsMessage({ address: ADDRESS, violation: VIOLATION, licensePlate })).toBe(
      '臺北市信義區信義路五段7號，有汽車於紅線停車，請派員處理',
    );
  });

  it.each([
    { licensePlates: ['ABC-1234', 'XYZ-5678'], segment: '，車牌號碼：ABC-1234、XYZ-5678' },
    { licensePlates: [], segment: '' },
    { licensePlates: [''], segment: '，車牌號碼：' },
  ])('preserves explicit licensePlates=%j and its precedence', ({ licensePlates, segment }) => {
    expect(
      composeSmsMessage({
        address: ADDRESS,
        violation: VIOLATION,
        licensePlate: 'IGNORED',
        licensePlates,
      }),
    ).toBe(`${ADDRESS}，有${VIOLATION}${segment}，請派員處理`);
  });

  it('preserves the template punctuation when all inputs are empty', () => {
    expect(composeSmsMessage({ address: '', violation: '', licensePlate: '' })).toBe(
      '，有，請派員處理',
    );
  });

  describe.each(['address', 'violation', 'licensePlate'] as const)('%s as literal text', (field) => {
    it.each([
      { name: 'matched-text replacement', value: '$&' },
      { name: 'dollar replacement', value: '$$' },
      { name: 'prefix replacement', value: '$`' },
      { name: 'suffix replacement', value: "$'" },
      { name: 'single dollar', value: '$' },
      { name: 'combined replacement syntax', value: "前$&|$$|$`|$'|$後" },
      { name: 'address placeholder', value: '{address}' },
      { name: 'violation placeholder', value: '{violation}' },
      { name: 'plate segment placeholder', value: '{plateSegment}' },
      { name: 'multiple placeholders', value: '{address}{violation}{plateSegment}' },
      { name: 'repeated placeholders', value: '{violation}{violation}{plateSegment}{plateSegment}' },
      { name: 'placeholders and replacement syntax', value: '$&{address}$${violation}$&{plateSegment}' },
      { name: 'empty string', value: '' },
      { name: 'multiline text', value: '第一行\n第二行\r\n第三行' },
      { name: 'Unicode', value: 'é e\u0301 日本語 Ελληνικά' },
      { name: 'emoji', value: '🚗🚨👩🏽‍🚒' },
      { name: 'Traditional Chinese', value: '臺灣車輛違規停車，請協助處理' },
      { name: 'punctuation and whitespace', value: ' 「」『』【】！？：；、，。—… /\\#%&=+ ' },
    ])('preserves $name verbatim', ({ value }) => {
      const input: SmsMessageInput = {
        address: ADDRESS,
        violation: VIOLATION,
        licensePlate: PLATE,
        [field]: value,
      };
      const plateSegment = input.licensePlate ? `，車牌號碼：${input.licensePlate}` : '';

      expect(composeSmsMessage(input)).toBe(
        `${input.address}，有${input.violation}${plateSegment}，請派員處理`,
      );
    });
  });

  it('preserves injected placeholders and replacement syntax across all fields and multiple plates', () => {
    const address = '臺北市{violation}{plateSegment}$&';
    const violation = "違停{address}{plateSegment}$$$`$'";
    const licensePlates = Object.freeze(['{address}$&', '{violation}$$', '{plateSegment}$']);
    const input = Object.freeze({ address, violation, licensePlates });

    expect(composeSmsMessage(input)).toBe(
      `${address}，有${violation}，車牌號碼：{address}$&、{violation}$$、{plateSegment}$，請派員處理`,
    );
  });

  describe('original template placeholders', () => {
    const originalTemplate = ZH_TW.smsMessage.template;

    afterEach(() => {
      Object.defineProperty(ZH_TW.smsMessage, 'template', { value: originalTemplate });
    });

    it('replaces every legal occurrence only in the original template', () => {
      Object.defineProperty(ZH_TW.smsMessage, 'template', {
        value: '{plateSegment}|{address}|{violation}|{address}|{plateSegment}|{violation}',
      });
      const address = '{violation}$&';
      const violation = '{plateSegment}$$';
      const licensePlate = '{address}$`';

      expect(composeSmsMessage({ address, violation, licensePlate })).toBe(
        `，車牌號碼：${licensePlate}|${address}|${violation}|${address}|，車牌號碼：${licensePlate}|${violation}`,
      );
    });

    it('preserves unknown tokens and literal replacement syntax in the template', () => {
      Object.defineProperty(ZH_TW.smsMessage, 'template', {
        value: "{unknown}|{Address}|{licensePlate}|{addressExtra}|{address}|$&|$$|$`|$'",
      });

      expect(composeSmsMessage({ address: ADDRESS, violation: VIOLATION, licensePlate: PLATE })).toBe(
        `{unknown}|{Address}|{licensePlate}|{addressExtra}|${ADDRESS}|$&|$$|$\`|$'`,
      );
    });

    it('replaces repeated legal placeholders with empty strings', () => {
      Object.defineProperty(ZH_TW.smsMessage, 'template', {
        value: '{address}{address}|{violation}{violation}|{plateSegment}{plateSegment}',
      });

      expect(composeSmsMessage({ address: '', violation: '', licensePlate: '' })).toBe('||');
    });
  });
});
