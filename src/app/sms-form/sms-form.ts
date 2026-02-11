import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS, PoliceStation } from '../police-stations';

@Component({
  selector: 'app-sms-form',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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
  protected stations = POLICE_STATIONS;

  protected smsForm = this.fb.group({
    district: [null as PoliceStation | null, [Validators.required]],
    message: ['', [Validators.required]],
  });

  protected get selectedStation(): PoliceStation | null {
    return this.smsForm.controls.district.value;
  }

  protected compareStations(a: PoliceStation | null, b: PoliceStation | null): boolean {
    return a?.district === b?.district;
  }

  protected sendSms(): void {
    if (this.smsForm.invalid) {
      this.smsForm.markAllAsTouched();
      return;
    }

    const station = this.smsForm.controls.district.value!;
    const message = this.smsForm.controls.message.value!;
    const link = this.smsService.generateSmsLink(station.phoneNumber, message);
    window.location.href = link;
  }
}
