import { Component, afterNextRender, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS, PoliceStation, findStationByAddress } from '../police-stations';
import { GeocodingService } from '../geocoding.service';

const VEHICLE_TYPES = ['汽車', '機車'] as const;
const VIOLATION_DESCRIPTIONS = [
  '於紅線停車',
  '於黃線停車',
  '於騎樓停車',
  '於人行道停車',
  '並排停車',
  '於轉彎處停車',
  '佔用車道影響交通',
];

const CAR_ONLY_DESCRIPTIONS = ['違法佔用孕婦及育有六歲以下兒童者停車位', '違法佔用殘障車位'];

const OTHER_VIOLATIONS = ['一般油車佔用電動車停車位', '雜物佔用國有地', '攤販於騎樓違法擺攤', '慢車未依規定停放'];

const VIOLATION_TYPES = [
  ...VEHICLE_TYPES.flatMap((v) => VIOLATION_DESCRIPTIONS.map((d) => `${v}${d}`)),
  ...CAR_ONLY_DESCRIPTIONS.map((d) => `汽車${d}`),
  ...OTHER_VIOLATIONS,
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

  protected isDesktop = signal(false);
  protected isLocating = signal(false);

  constructor() {
    afterNextRender(() => {
      this.isDesktop.set(this.smsService.isDesktop());
    });

    this.smsForm.controls.address.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((address) => {
        this.autoSelectDistrict(address || '');
      });
  }
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
    address: ['', [Validators.required, Validators.maxLength(100)]],
    district: [null as PoliceStation | null, [Validators.required]],
    violation: ['', [Validators.required, Validators.maxLength(50)]],
  });

  private addressValue = toSignal(this.smsForm.controls.address.valueChanges, { initialValue: '' });
  private violationValue = toSignal(this.smsForm.controls.violation.valueChanges, { initialValue: '' });
  private districtValue = toSignal(this.smsForm.controls.district.valueChanges, {
    initialValue: null as PoliceStation | null,
  });

  protected selectedStation = computed(() => this.districtValue());

  protected districtMismatch = computed(() => {
    const address = this.addressValue() ?? '';
    const selected = this.districtValue();
    const stationFromAddress = findStationByAddress(address);
    if (!stationFromAddress || !selected) return false;
    return stationFromAddress.district !== selected.district;
  });

  protected readonly SMS_CHAR_LIMIT = 70;

  protected composedMessage = computed(() => {
    const address = this.addressValue() ?? '';
    const violation = this.violationValue() ?? '';
    if (!address || !violation) return '';
    return `${address}，有${violation}，請派員處理`;
  });

  protected smsOverLimit = computed(() => {
    const msg = this.composedMessage();
    return msg.length > this.SMS_CHAR_LIMIT;
  });

  protected compareStations(a: PoliceStation | null, b: PoliceStation | null): boolean {
    if (!a || !b) return a === b;
    return a.district === b.district && a.phoneNumber === b.phoneNumber;
  }

  protected onViolationInput(event: Event): void {
    this.violationFilter.set((event.target as HTMLInputElement).value);
  }

  protected async locateUser(): Promise<void> {
    if (this.isLocating()) return;
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
    if (this.smsForm.invalid || this.districtMismatch()) {
      this.smsForm.markAllAsTouched();
      return;
    }

    const station = this.smsForm.controls.district.value;
    if (!station) return;
    this.smsService.sendSms(station.phoneNumber, this.composedMessage());
  }

  private autoSelectDistrict(address: string): void {
    const station = findStationByAddress(address);
    if (station) {
      this.smsForm.controls.district.setValue(station);
    }
  }
}
