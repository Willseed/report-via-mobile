import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { form, FormField, required, maxLength, pattern } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ZH_TW } from '../../i18n';

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

const CAR_ONLY_DESCRIPTIONS = [
  '違法佔用孕婦及育有六歲以下兒童者停車位',
  '違法佔用身心障礙者專用停車位',
  '佔用機車停車位',
];

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

export const VIOLATION_FILTER_DEBOUNCE_MS = 150;
export const VIOLATION_MAX_LENGTH = 50;
export const LICENSE_PLATE_MAX_LENGTH = 10;
export const LICENSE_PLATE_PATTERN = /^[A-Z0-9]*$/;

@Component({
  selector: 'app-violation-input',
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './violation-input.html',
  styleUrl: './violation-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViolationInput {
  private injector = inject(Injector);
  private destroyRef = inject(DestroyRef);
  private filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  protected readonly i18n = ZH_TW;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.filterDebounceTimer) clearTimeout(this.filterDebounceTimer);
    });
  }

  private licensePlateInputRef = viewChild<ElementRef<HTMLInputElement>>('licensePlateInput');
  private addPlateButton = viewChild<ElementRef<HTMLButtonElement>>('addPlateButton');

  readonly violation = model('');
  readonly licensePlate = model('');

  protected violationTypes = VIOLATION_TYPES;
  protected violationFilter = signal('');
  protected showLicensePlate = signal(false);

  protected filteredViolations = computed(() => {
    const filter = this.violationFilter();
    if (!filter || this.violationTypes.includes(filter)) return this.violationTypes;
    return this.violationTypes.filter((type) => type.includes(filter));
  });

  private formModel = signal({ violation: '', licensePlate: '' });
  protected violationForm = form(this.formModel, (schema) => {
    required(schema.violation, { message: ZH_TW.violation.required });
    maxLength(schema.violation, VIOLATION_MAX_LENGTH, { message: ZH_TW.violation.maxLength });
    maxLength(schema.licensePlate, LICENSE_PLATE_MAX_LENGTH, {
      message: ZH_TW.violation.licensePlateMaxLength,
    });
    pattern(schema.licensePlate, LICENSE_PLATE_PATTERN, {
      message: ZH_TW.violation.licensePlatePattern,
    });
  });

  protected onViolationInput(event: Event): void {
    const target = event.target as EventTarget & { value: string };
    const value = target.value;
    this.violationForm.violation().value.set(value);

    if (this.filterDebounceTimer) clearTimeout(this.filterDebounceTimer);
    this.filterDebounceTimer = setTimeout(() => {
      this.violation.set(value);
      this.violationFilter.set(value);
    }, VIOLATION_FILTER_DEBOUNCE_MS);
  }

  protected onViolationChange(): void {
    if (this.filterDebounceTimer) {
      clearTimeout(this.filterDebounceTimer);
      this.filterDebounceTimer = null;
    }
    const value = this.violationForm.violation().value();
    this.violation.set(value);
    this.violationFilter.set(value);
  }

  protected toggleLicensePlate(): void {
    this.showLicensePlate.set(true);
    afterNextRender(
      () => {
        this.licensePlateInputRef()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected clearLicensePlate(): void {
    this.violationForm.licensePlate().value.set('');
    this.licensePlate.set('');
    this.showLicensePlate.set(false);
    afterNextRender(
      () => {
        this.addPlateButton()?.nativeElement.focus();
      },
      { injector: this.injector },
    );
  }

  protected onLicensePlateInput(event: Event): void {
    const target = event.target as EventTarget & { value: string };
    const cleaned = target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    this.violationForm.licensePlate().value.set(cleaned);
    if (target.value !== cleaned) {
      target.value = cleaned;
    }
    this.licensePlate.set(cleaned);
  }

  markAsTouched(): void {
    this.violationForm.violation().markAsTouched();
    this.violationForm.licensePlate().markAsTouched();
  }

  readonly valid = computed(() => this.violationForm().valid());
}
