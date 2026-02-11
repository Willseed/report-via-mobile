import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SmsService } from './sms.service';

describe('SmsService', () => {
  let service: SmsService;
  const originalNavigator = navigator.userAgent;

  function mockUserAgent(ua: string) {
    Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
  }

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalNavigator, configurable: true });
  });

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SmsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('generateSmsLink', () => {
    it('should use ? separator for Android', () => {
      mockUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36');
      const link = service.generateSmsLink('0912345678', 'Hello');
      expect(link).toBe('sms:0912345678?body=Hello');
    });

    it('should use & separator for iOS', () => {
      mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
      const link = service.generateSmsLink('0912345678', 'Hello');
      expect(link).toBe('sms:0912345678&body=Hello');
    });

    it('should sanitize phone number by stripping non-numeric characters except +', () => {
      mockUserAgent('Mozilla/5.0 (Linux; Android 13)');
      const link = service.generateSmsLink('+886-912-345-678', 'Hi');
      expect(link).toBe('sms:+886912345678?body=Hi');
    });

    it('should encode message body', () => {
      mockUserAgent('Mozilla/5.0 (Linux; Android 13)');
      const link = service.generateSmsLink('0912345678', 'Hello World & Goodbye');
      expect(link).toBe('sms:0912345678?body=Hello%20World%20%26%20Goodbye');
    });

    it('should handle empty body', () => {
      mockUserAgent('Mozilla/5.0 (Linux; Android 13)');
      const link = service.generateSmsLink('0912345678', '');
      expect(link).toBe('sms:0912345678?body=');
    });
  });

  describe('isDesktop', () => {
    it('should return true for desktop user agent', () => {
      mockUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      expect(service.isDesktop()).toBe(true);
    });

    it('should return false for Android', () => {
      mockUserAgent('Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile');
      expect(service.isDesktop()).toBe(false);
    });

    it('should return false for iPhone', () => {
      mockUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
      expect(service.isDesktop()).toBe(false);
    });
  });
});
