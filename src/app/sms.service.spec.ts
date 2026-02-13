import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { describe, it, expect } from 'vitest';
import { Platform } from '@angular/cdk/platform';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  function createService(
    platformOverrides: Partial<Platform> = {},
    mockDocument?: { location: { href: string } },
  ) {
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

  it('should be created', () => {
    const service = createService();
    expect(service).toBeTruthy();
  });

  describe('generateSmsLink', () => {
    it('should use ? separator for Android', () => {
      const service = createService({ ANDROID: true });
      const link = service.generateSmsLink('0912345678', 'Hello');
      expect(link).toBe('sms:0912345678?body=Hello');
    });

    it('should use & separator for iOS', () => {
      const service = createService({ IOS: true });
      const link = service.generateSmsLink('0912345678', 'Hello');
      expect(link).toBe('sms:0912345678&body=Hello');
    });

    it('should sanitize phone number by stripping non-numeric characters except +', () => {
      const service = createService({ ANDROID: true });
      const link = service.generateSmsLink('+886-912-345-678', 'Hi');
      expect(link).toBe('sms:+886912345678?body=Hi');
    });

    it('should encode message body', () => {
      const service = createService({ ANDROID: true });
      const link = service.generateSmsLink('0912345678', 'Hello World & Goodbye');
      expect(link).toBe('sms:0912345678?body=Hello%20World%20%26%20Goodbye');
    });

    it('should handle empty body', () => {
      const service = createService({ ANDROID: true });
      const link = service.generateSmsLink('0912345678', '');
      expect(link).toBe('sms:0912345678?body=');
    });
  });

  describe('sendSms', () => {
    it('should set document.location.href to SMS link', () => {
      const mockDoc = { location: { href: '' } };
      const service = createService({ ANDROID: true }, mockDoc);
      service.sendSms('0912345678', 'Hello');
      expect(mockDoc.location.href).toBe('sms:0912345678?body=Hello');
    });
  });

  describe('isDesktop', () => {
    it('should return true for desktop platform', () => {
      const service = createService({ ANDROID: false, IOS: false });
      expect(service.isDesktop()).toBe(true);
    });

    it('should return false for Android', () => {
      const service = createService({ ANDROID: true });
      expect(service.isDesktop()).toBe(false);
    });

    it('should return false for iOS', () => {
      const service = createService({ IOS: true });
      expect(service.isDesktop()).toBe(false);
    });
  });
});
