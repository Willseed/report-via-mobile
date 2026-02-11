import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS, PoliceStation, findStationByAddress } from '../police-stations';
import { GeocodingService } from '../geocoding.service';

const VIOLATION_TYPES = [
  '汽車於紅線停車',
  '汽車於黃線停車',
  '汽車於騎樓停車',
  '汽車於人行道停車',
  '汽車並排停車',
  '機車於紅線停車',
  '機車於黃線停車',
  '機車於騎樓停車',
  '機車於人行道停車',
  '機車並排停車',
];

@Component({
  selector: 'app-sms-form',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
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
  protected violationFilter = signal('');
  protected filteredViolations = computed(() => {
    const filter = this.violationFilter();
    if (!filter || this.violationTypes.includes(filter)) return this.violationTypes;
    return this.violationTypes.filter((type) => type.includes(filter));
  });

  protected smsForm = this.fb.group({
    address: ['', [Validators.required]],
    district: [null as PoliceStation | null, [Validators.required]],
    violation: ['', [Validators.required]],
  });

  protected get selectedStation(): PoliceStation | null {
    return this.smsForm.controls.district.value;
  }

  protected get composedMessage(): string {
    const address = this.smsForm.controls.address.value ?? '';
    const violation = this.smsForm.controls.violation.value ?? '';
    if (!address || !violation) return '';
    return `${address}，有${violation}，請派員處理`;
  }

  protected compareStations(a: PoliceStation | null, b: PoliceStation | null): boolean {
    return a?.district === b?.district;
  }

  protected onViolationInput(): void {
    this.violationFilter.set(this.smsForm.controls.violation.value ?? '');
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
    const link = this.smsService.generateSmsLink(station.phoneNumber, this.composedMessage);
    window.location.href = link;
  }

  private autoSelectDistrict(address: string): void {
    const station = findStationByAddress(address);
    if (station) {
      this.smsForm.controls.district.setValue(station);
    }
  }
}
