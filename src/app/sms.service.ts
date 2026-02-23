import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Platform } from '@angular/cdk/platform';
import { ZH_TW } from './i18n';

const IOS_SMS_RECOMMENDED_LIMIT = 1600;

@Injectable({ providedIn: 'root' })
export class SmsService {
  private document = inject(DOCUMENT);
  private platform = inject(Platform);

  sendSms(phone: string, body: string): void {
    const sanitizedBody = this.sanitizeBody(body);
    if (!this.isMessageLengthRecommended(sanitizedBody)) return;
    const link = this.generateSmsLink(phone, sanitizedBody);
    this.document.location.assign(link);
  }

  generateSmsLink(phone: string, body: string): string {
    const sanitizedPhone = this.sanitizePhone(phone);
    const encodedBody = encodeURIComponent(this.sanitizeBody(body));
    const separator = this.platform.IOS ? '&' : '?';

    return `sms:${sanitizedPhone}${separator}body=${encodedBody}`;
  }

  isDesktop(): boolean {
    return !this.platform.ANDROID && !this.platform.IOS;
  }

  private sanitizePhone(phone: string): string {
    return phone.replace(/[^0-9+]/g, '');
  }

  private sanitizeBody(body: string): string {
    return body.replace(/\p{Cc}/gu, ' ');
  }

  private isMessageLengthRecommended(body: string): boolean {
    if (!this.platform.IOS) return true;
    if (body.length < IOS_SMS_RECOMMENDED_LIMIT) return true;
    globalThis.alert?.(ZH_TW.smsForm.iosLengthWarning);
    return false;
  }
}
