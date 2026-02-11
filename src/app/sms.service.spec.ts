import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { Platform } from '@angular/cdk/platform';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  function createService(platformOverrides: Partial<Platform> = {}) {
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

    TestBed.configureTestingModule({
      providers: [{ provide: Platform, useValue: mockPlatform }],
    });
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
