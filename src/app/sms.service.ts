import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Platform } from '@angular/cdk/platform';

@Injectable({ providedIn: 'root' })
export class SmsService {
  private document = inject(DOCUMENT);
  private platform = inject(Platform);

  sendSms(phone: string, body: string): void {
    const link = this.generateSmsLink(phone, body);
    this.document.location.href = link;
  }

  generateSmsLink(phone: string, body: string): string {
    const sanitizedPhone = this.sanitizePhone(phone);
    const encodedBody = encodeURIComponent(body);
    const separator = this.platform.IOS ? '&' : '?';

    return `sms:${sanitizedPhone}${separator}body=${encodedBody}`;
  }

  isDesktop(): boolean {
    return !this.platform.ANDROID && !this.platform.IOS;
  }

  private sanitizePhone(phone: string): string {
    return phone.replace(/[^0-9+]/g, '');
  }
}
