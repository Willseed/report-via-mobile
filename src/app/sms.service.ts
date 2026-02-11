import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SmsService {
  generateSmsLink(phone: string, body: string): string {
    const sanitizedPhone = this.sanitizePhone(phone);
    const encodedBody = encodeURIComponent(body);
    const separator = this.isIos() ? '&' : '?';

    return `sms:${sanitizedPhone}${separator}body=${encodedBody}`;
  }

  isDesktop(): boolean {
    const ua = navigator.userAgent;
    return !/Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  }

  private sanitizePhone(phone: string): string {
    return phone.replace(/[^0-9+]/g, '');
  }

  private isIos(): boolean {
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(ua);
  }
}
