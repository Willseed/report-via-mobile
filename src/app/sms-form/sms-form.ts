import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS, PoliceStation, findStationByAddress } from '../police-stations';
import { GeocodingService } from '../geocoding.service';

const VIOLATION_TYPES = ['黃線停車', '紅線停車', '騎樓停車', '人行道停車', '並排停車'];

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
  private geocodingService = inject(GeocodingService);

  protected isDesktop = signal(this.smsService.isDesktop());
  protected isLocating = signal(false);
  protected locationError = signal('');
  protected stations = POLICE_STATIONS;
  protected violationTypes = VIOLATION_TYPES;

  protected smsForm = this.fb.group({
    address: [''],
    district: [null as PoliceStation | null, [Validators.required]],
    violation: [''],
    message: ['', [Validators.required]],
  });

  protected get selectedStation(): PoliceStation | null {
    return this.smsForm.controls.district.value;
  }

  protected compareStations(a: PoliceStation | null, b: PoliceStation | null): boolean {
    return a?.district === b?.district;
  }

  protected onViolationChange(): void {
    const violation = this.smsForm.controls.violation.value;
    if (violation) {
      this.smsForm.controls.message.setValue(violation);
    }
  }

  protected onAddressInput(): void {
    const address = this.smsForm.controls.address.value ?? '';
    this.autoSelectDistrict(address);
  }

  protected async locateUser(): Promise<void> {
    this.isLocating.set(true);
    this.locationError.set('');
    try {
      const position = await this.geocodingService.getCurrentPosition();
      const { latitude, longitude } = position.coords;
      const displayName = await this.geocodingService.reverseGeocode(latitude, longitude);
      this.smsForm.controls.address.setValue(displayName);
      this.autoSelectDistrict(displayName);
    } catch (e) {
      this.locationError.set(e instanceof Error ? e.message : '定位失敗，請稍後再試。');
    } finally {
      this.isLocating.set(false);
    }
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

  private autoSelectDistrict(address: string): void {
    const station = findStationByAddress(address);
    if (station) {
      this.smsForm.controls.district.setValue(station);
    }
  }
}
