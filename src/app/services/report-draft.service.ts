import { Injectable, computed, inject } from '@angular/core';
import { LocationResolverService } from './location-resolver.service';
import { MessageComposerService } from './message-composer.service';
import { ReportFormService } from './report-form.service';

export const VIOLATION_LOOKUP_DEBOUNCE_MS = 150;

export interface ReportSubmitData {
  readonly stationName: string;
  readonly phoneNumber: string;
  readonly message: string;
  readonly licensePlate?: string;
}

@Injectable({ providedIn: 'root' })
export class ReportDraftService {
  private readonly formService = inject(ReportFormService);
  private readonly location = inject(LocationResolverService);
  private readonly composer = inject(MessageComposerService);

  readonly form = this.formService.violationForm;
  readonly violationTypes = this.formService.violationTypes;
  readonly filteredViolations = this.formService.filteredViolations;
  readonly selectedViolation = this.formService.violation;
  readonly licensePlate = this.formService.licensePlate;
  readonly violationFilter = this.formService.violationFilter;
  readonly showLicensePlate = this.formService.showLicensePlate;
  readonly isViolationValid = this.formService.violationFormValid;
  readonly smsMessage = this.composer.composedMessage;
  readonly pendingPreview = this.composer.pendingPreview;
  readonly hasDistrictMismatch = this.composer.districtMismatch;
  readonly isFormValid = computed(
    () =>
      this.formService.locationValid() &&
      this.formService.violationFormValid() &&
      !this.composer.districtMismatch(),
  );
  readonly submitData = computed<ReportSubmitData | null>(() => {
    if (!this.isFormValid()) return null;
    const station = this.formService.station();
    const message = this.composer.composedMessage();
    if (!station || !message) return null;
    return {
      stationName: station.stationName,
      phoneNumber: station.phoneNumber,
      message,
      licensePlate: this.formService.licensePlate() || undefined,
    };
  });

  updateViolation(value: string = this.form.violation().value()): void {
    this.formService.handleViolationChange(value);
  }

  updateViolationInput(value: string): void {
    this.formService.handleViolationInput(value, VIOLATION_LOOKUP_DEBOUNCE_MS);
  }

  updateViolationFilter(value: string): void {
    this.formService.setViolationFilter(value);
  }

  updateLicensePlate(value: string): string {
    return this.formService.handleLicensePlateInput(value);
  }

  touchAllFields(): void {
    this.formService.markLocationTouched();
    this.formService.markViolationTouched();
  }

  markViolationTouched(): void {
    this.formService.markViolationTouched();
  }

  resetForm(): void {
    this.location.clearAddressDebounce();
    this.formService.resetForm();
    this.location.resetLocationState();
  }

  showLicensePlateField(): void {
    this.formService.showLicensePlateField();
  }

  clearLicensePlate(): void {
    this.formService.clearLicensePlate();
  }

  clearViolationDebounce(): void {
    this.formService.clearViolationDebounce();
  }
}
