import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SmsService } from '../sms.service';

@Component({
  selector: 'app-sms-form',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './sms-form.html',
  styleUrl: './sms-form.scss',
})
export class SmsForm {
  private fb = inject(FormBuilder);
  private smsService = inject(SmsService);

  protected isDesktop = signal(this.smsService.isDesktop());

  protected smsForm = this.fb.nonNullable.group({
    recipient: ['', [Validators.required, Validators.pattern(/^[0-9+]*$/)]],
    message: ['', [Validators.required]],
  });

  protected sendSms(): void {
    if (this.smsForm.invalid) {
      this.smsForm.markAllAsTouched();
      return;
    }

    const { recipient, message } = this.smsForm.getRawValue();
    const link = this.smsService.generateSmsLink(recipient, message);
    window.location.href = link;
  }
}
