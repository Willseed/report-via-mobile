import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { Platform } from '@angular/cdk/platform';
import fc from 'fast-check';
import { ZH_TW } from './i18n';
import { SmsService } from './sms.service';

const SMS_PROPERTY_CONFIG = {
  numRuns: 100,
  seed: 51753101,
};

function sanitizePhoneForExpectation(phone: string): string {
  return phone.replace(/[^0-9+]/g, '');
}

function sanitizeBodyForExpectation(body: string): string {
  return body.replace(/\p{Cc}/gu, ' ');
}

function createService(
  platformOverrides: Partial<Platform> = {},
  mockDocument?: { location: { assign: ReturnType<typeof import('vitest').vi.fn> } },
) {
  TestBed.resetTestingModule();

  const mockPlatform = {
    ANDROID: false,
    IOS: false,
    isBrowser: true,
    BLINK: false,
    WEBKIT: false,
    TRIDENT: false,
    EDGE: false,
    FIREFOX: false,
    SAFARI: false,
    ...platformOverrides,
  } as Platform;

  const providers: unknown[] = [{ provide: Platform, useValue: mockPlatform }];
  if (mockDocument) {
    providers.push({ provide: DOCUMENT, useValue: mockDocument });
  }

  TestBed.configureTestingModule({ providers });
  return TestBed.inject(SmsService);
}

function createMockDocument() {
  return { location: { assign: vi.fn() } };
}

function expectSmsLink(
  platform: Partial<Platform>,
  phone: string,
  body: string,
  expected: string,
) {
  const service = createService(platform);
  expect(service.generateSmsLink(phone, body)).toBe(expected);
}

describe('SmsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should be created', () => {
    const service = createService();
    expect(service).toBeTruthy();
  });

  describe('generateSmsLink', () => {
    it.each([
      {
        description: 'use ? separator for Android',
        platform: { ANDROID: true },
        phone: '0912345678',
        body: 'Hello',
        expected: 'sms:0912345678?body=Hello',
      },
      {
        description: 'use & separator for iOS',
        platform: { IOS: true },
        phone: '0912345678',
        body: 'Hello',
        expected: 'sms:0912345678&body=Hello',
      },
      {
        description: 'sanitize phone number by stripping non-numeric characters except +',
        platform: { ANDROID: true },
        phone: '+886-912-345-678',
        body: 'Hi',
        expected: 'sms:+886912345678?body=Hi',
      },
      {
        description: 'encode message body',
        platform: { ANDROID: true },
        phone: '0912345678',
        body: 'Hello World & Goodbye',
        expected: 'sms:0912345678?body=Hello%20World%20%26%20Goodbye',
      },
      {
        description: 'filter control characters in body',
        platform: { ANDROID: true },
        phone: '0912345678',
        body: 'Hello\nWorld',
        expected: 'sms:0912345678?body=Hello%20World',
      },
      {
        description: 'handle empty body',
        platform: { ANDROID: true },
        phone: '0912345678',
        body: '',
        expected: 'sms:0912345678?body=',
      },
      {
        description: 'encode iOS Unicode body after replacing newlines',
        platform: { IOS: true },
        phone: '0912345678',
        body: '臺北市\n信義區，請派員處理',
        expected: `sms:0912345678&body=${encodeURIComponent('臺北市 信義區，請派員處理')}`,
      },
      {
        description: 'keep iOS empty body parameter explicit',
        platform: { IOS: true },
        phone: '0912345678',
        body: '',
        expected: 'sms:0912345678&body=',
      },
    ])('should $description', ({ platform, phone, body, expected }) => {
      expectSmsLink(platform, phone, body, expected);
    });

    it('should preserve phone sanitization invariants for Android links', () => {
      const service = createService({ ANDROID: true });

      fc.assert(
        fc.property(
          fc.string({ unit: 'grapheme', maxLength: 40 }),
          fc.string({ unit: 'grapheme', maxLength: 80 }),
          (phone, body) => {
            const expectedPhone = sanitizePhoneForExpectation(phone);
            const link = service.generateSmsLink(phone, body);
            const [, remainder] = link.split('sms:');
            const [phonePart, encodedBody] = remainder.split('?body=');

            expect(phonePart).toBe(expectedPhone);
            expect(phonePart).toMatch(/^[0-9+]*$/);
            expect(decodeURIComponent(encodedBody)).toBe(sanitizeBodyForExpectation(body));
          },
        ),
        SMS_PROPERTY_CONFIG,
      );
    });

    it('should keep platform-specific separators deterministic', () => {
      const androidService = createService({ ANDROID: true });
      const iosService = createService({ IOS: true });

      fc.assert(
        fc.property(
          fc.string({ unit: 'grapheme', maxLength: 40 }),
          fc.string({ unit: 'grapheme', maxLength: 80 }),
          (phone, body) => {
            const androidLink = androidService.generateSmsLink(phone, body);
            const iosLink = iosService.generateSmsLink(phone, body);

            expect(androidLink).toContain('?body=');
            expect(androidLink).not.toContain('&body=');
            expect(iosLink).toContain('&body=');
            expect(iosLink).not.toContain('?body=');
          },
        ),
        { ...SMS_PROPERTY_CONFIG, seed: 51753102 },
      );
    });
  });

  describe('sendSms', () => {
    it('should navigate to SMS link via location.assign', () => {
      const mockDoc = createMockDocument();
      const service = createService({ ANDROID: true }, mockDoc);
      service.sendSms('0912345678', 'Hello');
      expect(mockDoc.location.assign).toHaveBeenCalledWith('sms:0912345678?body=Hello');
    });

    it('should navigate with sanitized phone and iOS encoded Unicode body', () => {
      const mockDoc = createMockDocument();
      const service = createService({ IOS: true }, mockDoc);

      service.sendSms('+886-912-345-678', '臺北市\n信義區，請派員處理');

      expect(mockDoc.location.assign).toHaveBeenCalledWith(
        `sms:+886912345678&body=${encodeURIComponent('臺北市 信義區，請派員處理')}`,
      );
    });

    it('should keep an explicit empty body parameter when sending', () => {
      const mockDoc = createMockDocument();
      const service = createService({ ANDROID: true }, mockDoc);

      service.sendSms('0912345678', '');

      expect(mockDoc.location.assign).toHaveBeenCalledWith('sms:0912345678?body=');
    });

    it('should warn and avoid navigation for over-limit iOS messages', () => {
      const mockDoc = createMockDocument();
      const alertSpy = vi.fn();
      vi.stubGlobal('alert', alertSpy);
      const service = createService({ IOS: true }, mockDoc);

      service.sendSms('0912345678', '警'.repeat(1600));

      expect(alertSpy).toHaveBeenCalledWith(ZH_TW.smsForm.iosLengthWarning);
      expect(mockDoc.location.assign).not.toHaveBeenCalled();
    });
  });

  describe('isDesktop', () => {
    it.each([
      {
        description: 'desktop platform',
        platform: { ANDROID: false, IOS: false },
        expected: true,
      },
      {
        description: 'Android',
        platform: { ANDROID: true },
        expected: false,
      },
      {
        description: 'iOS',
        platform: { IOS: true },
        expected: false,
      },
      {
        description: 'Android WebView-like platform',
        platform: { ANDROID: true, isBrowser: false },
        expected: false,
      },
    ])('should return $expected for $description', ({ platform, expected }) => {
      const service = createService(platform);
      expect(service.isDesktop()).toBe(expected);
    });
  });
});
