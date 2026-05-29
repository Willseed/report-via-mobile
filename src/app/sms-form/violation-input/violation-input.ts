import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ZH_TW } from '../../i18n';
import { ReportDraftService } from '../../services/report-draft.service';

export {
  VIOLATION_LOOKUP_DEBOUNCE_MS as VIOLATION_FILTER_DEBOUNCE_MS,
} from '../../services/report-draft.service';
export {
  VIOLATION_MAX_LENGTH,
  LICENSE_PLATE_MAX_LENGTH,
  LICENSE_PLATE_PATTERN,
} from '../../domain/violation.utils';

const readInputValue = (event: Event): string =>
  (event.target as EventTarget & { value: string }).value;

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
  private readonly draft = inject(ReportDraftService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly licensePlateInputRef = viewChild<ElementRef<HTMLInputElement>>('licensePlateInput');
  private readonly addPlateButton = viewChild<ElementRef<HTMLButtonElement>>('addPlateButton');

  protected readonly i18n = ZH_TW;
  protected readonly violationForm = this.draft.form;
  protected readonly violationTypes = this.draft.violationTypes;
  protected readonly filteredViolations = this.draft.filteredViolations;
  protected readonly showLicensePlate = this.draft.showLicensePlate;

  readonly violation = this.draft.selectedViolation;
  readonly licensePlate = this.draft.licensePlate;
  readonly violationFilter = this.draft.violationFilter;

  constructor() {
    this.destroyRef.onDestroy(() => this.draft.clearViolationDebounce());
  }

  protected onViolationInput(event: Event): void {
    this.draft.updateViolationInput(readInputValue(event));
  }

  protected onViolationChange(value?: string): void {
    this.draft.updateViolation(value);
  }

  protected toggleLicensePlate(): void {
    this.draft.showLicensePlateField();
    afterNextRender(
      () => {
        this.licensePlateInputRef()?.nativeElement?.focus();
      },
      { injector: this.injector },
    );
  }

  protected clearLicensePlate(): void {
    this.draft.clearLicensePlate();
    afterNextRender(
      () => {
        this.addPlateButton()?.nativeElement?.focus();
      },
      { injector: this.injector },
    );
  }

  protected onLicensePlateInput(event: Event): void {
    const target = event.target as EventTarget & { value: string };
    const cleaned = this.draft.updateLicensePlate(target.value);
    if (target.value !== cleaned) {
      target.value = cleaned;
    }
  }

  markAsTouched(): void {
    this.draft.markViolationTouched();
  }

  readonly valid = this.draft.isViolationValid;
}
