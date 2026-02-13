import { afterNextRender, ChangeDetectionStrategy, Component, computed, ElementRef, inject, Injector, signal, viewChild } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { SmsService } from '../sms.service';
import { POLICE_STATIONS, PoliceStation, findStationByAddress } from '../police-stations';
import { GeocodingService, DEFAULT_GEOLOCATION_ERROR_MSG } from '../geocoding.service';
import { ConfirmDialog, ConfirmDialogData } from './confirm-dialog';

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

const OTHER_VIOLATIONS = [
  '一般油車佔用電動車停車位',
  '雜物佔用國有地',
  '攤販於騎樓違法擺攤',
  '慢車未依規定停放',
  '物品堆置於道路（含騎樓、人行道）妨礙交通',
];

const VIOLATION_TYPES = [
  ...VEHICLE_TYPES.flatMap((v) => VIOLATION_DESCRIPTIONS.map((d) => `${v}${d}`)),
  ...CAR_ONLY_DESCRIPTIONS.map((d) => `汽車${d}`),
  ...OTHER_VIOLATIONS,
];

export const DISTRICT_SEARCH_DEBOUNCE_MS = 300;
export const ADDRESS_MAX_LENGTH = 100;
export const VIOLATION_MAX_LENGTH = 50;
export const LICENSE_PLATE_MAX_LENGTH = 10;
export const LICENSE_PLATE_PATTERN = /^[A-Z0-9]*$/;

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
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmsForm {
  private fb = inject(FormBuilder);
  private smsService = inject(SmsService);
  private geocodingService = inject(GeocodingService);
  private dialog = inject(MatDialog);
  private injector = inject(Injector);

  private licensePlateInput = viewChild<ElementRef<HTMLInputElement>>('licensePlateInput');
  private addPlateButton = viewChild<ElementRef<HTMLButtonElement>>('addPlateButton');

  protected isDesktop = signal(this.smsService.isDesktop());
  protected isLocating = signal(false);

  constructor() {
    this.smsForm.controls.address.valueChanges
      .pipe(debounceTime(DISTRICT_SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
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
    address: ['', [Validators.required, Validators.maxLength(ADDRESS_MAX_LENGTH)]],
    district: [null as PoliceStation | null, [Validators.required]],
    violation: ['', [Validators.required, Validators.maxLength(VIOLATION_MAX_LENGTH)]],
    licensePlate: ['', [Validators.maxLength(LICENSE_PLATE_MAX_LENGTH), Validators.pattern(LICENSE_PLATE_PATTERN)]],
  });

  protected showLicensePlate = signal(false);

  private addressValue = toSignal(this.smsForm.controls.address.valueChanges, { initialValue: '' });
  private violationValue = toSignal(this.smsForm.controls.violation.valueChanges, { initialValue: '' });
  private licensePlateValue = toSignal(this.smsForm.controls.licensePlate.valueChanges, { initialValue: '' });
  protected districtValue = toSignal(this.smsForm.controls.district.valueChanges, {
    initialValue: null as PoliceStation | null,
  });

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
    const plate = this.licensePlateValue() ?? '';
    if (!address || !violation) return '';
    const plateSegment = plate ? `，車牌號碼：${plate}` : '';
    return `${address}，有${violation}${plateSegment}，請派員處理`;
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
    // CodeQL 合規修正：violationFilter 僅供過濾用，不直接渲染，且 autocomplete 有 requireSelection
    this.violationFilter.set(
      (event.target as HTMLInputElement).value.replace(/[<>]/g, ''),
    );
  }

  protected toggleLicensePlate(): void {
    this.showLicensePlate.set(true);
    afterNextRender(() => {
      this.licensePlateInput()?.nativeElement.focus();
    }, { injector: this.injector });
  }

  protected clearLicensePlate(): void {
    this.smsForm.controls.licensePlate.setValue('');
    this.showLicensePlate.set(false);
    afterNextRender(() => {
      this.addPlateButton()?.nativeElement.focus();
    }, { injector: this.injector });
  }

  protected onLicensePlateInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const cleaned = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    if (input.value !== cleaned) {
      this.smsForm.controls.licensePlate.setValue(cleaned, { emitEvent: true });
    }
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
      this.locationError.set(e instanceof Error ? e.message : DEFAULT_GEOLOCATION_ERROR_MSG);
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

    const data: ConfirmDialogData = {
      stationName: station.stationName,
      phoneNumber: station.phoneNumber,
      message: this.composedMessage(),
      licensePlate: this.smsForm.controls.licensePlate.value || undefined,
    };

    this.dialog
      .open(ConfirmDialog, { data, width: '92vw', maxWidth: '400px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.smsService.sendSms(data.phoneNumber, data.message);
        }
      });
  }

  private autoSelectDistrict(address: string): void {
    const station = findStationByAddress(address);
    if (station) {
      this.smsForm.controls.district.setValue(station);
    }
  }
}
