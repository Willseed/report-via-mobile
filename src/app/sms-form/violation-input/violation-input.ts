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
import { ReportStateService } from '../../services/report-state.service';

export const VIOLATION_FILTER_DEBOUNCE_MS = 150;
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
  private readonly state = inject(ReportStateService);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);

  private readonly licensePlateInputRef = viewChild<ElementRef<HTMLInputElement>>('licensePlateInput');
  private readonly addPlateButton = viewChild<ElementRef<HTMLButtonElement>>('addPlateButton');

  protected readonly i18n = ZH_TW;
  protected readonly violationForm = this.state.violationForm;
  protected readonly violationTypes = this.state.violationTypes;
  protected readonly filteredViolations = this.state.filteredViolations;
  protected readonly showLicensePlate = this.state.showLicensePlate;

  readonly violation = this.state.violation;
  readonly licensePlate = this.state.licensePlate;
  readonly violationFilter = this.state.violationFilter;

  constructor() {
    this.destroyRef.onDestroy(() => this.state.clearViolationDebounce());
  }

  protected onViolationInput(event: Event): void {
    this.state.handleViolationInput(readInputValue(event), VIOLATION_FILTER_DEBOUNCE_MS);
  }

  protected onViolationChange(value?: string): void {
    this.state.handleViolationChange(value);
  }

  protected toggleLicensePlate(): void {
    this.state.showLicensePlateField();
    afterNextRender(
      () => {
        this.licensePlateInputRef()?.nativeElement?.focus();
      },
      { injector: this.injector },
    );
  }

  protected clearLicensePlate(): void {
    this.state.clearLicensePlate();
    afterNextRender(
      () => {
        this.addPlateButton()?.nativeElement?.focus();
      },
      { injector: this.injector },
    );
  }

  protected onLicensePlateInput(event: Event): void {
    const target = event.target as EventTarget & { value: string };
    const cleaned = this.state.handleLicensePlateInput(target.value);
    if (target.value !== cleaned) {
      target.value = cleaned;
    }
  }

  markAsTouched(): void {
    this.state.markViolationTouched();
  }

  readonly valid = this.state.violationFormValid;
}
