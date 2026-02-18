import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { type PoliceStation } from '../../domain/police-stations';
import { ZH_TW } from '../../i18n';
import { ReportStateService } from '../../services/report-state.service';

export const DISTRICT_SEARCH_DEBOUNCE_MS = 300;
export { ADDRESS_MAX_LENGTH } from '../../domain/address.utils';

const readInputValue = (event: Event): string =>
  (event.target as EventTarget & { value: string }).value;

@Component({
  selector: 'app-location-input',
  imports: [
    FormField,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
  ],
  templateUrl: './location-input.html',
  styleUrl: './location-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationInput {
  private state = inject(ReportStateService);
  private districtSelect = viewChild(MatSelect);

  protected readonly i18n = ZH_TW;
  protected addressForm = this.state.addressForm;
  protected stations = this.state.stations;
  protected manualInputFallback = this.state.manualInputFallback;
  protected isLocating = this.state.isLocating;
  protected locationError = this.state.locationError;
  protected locationStatus = this.state.locationStatus;
  protected compareStations = this.state.compareStations;

  readonly address = this.state.address;
  readonly district = this.state.station;
  readonly districtMismatch = this.state.districtMismatch;
  readonly valid = this.state.locationValid;
  readonly districtRequired = this.state.districtRequired;

  constructor() {
    effect(() => {
      const select = this.districtSelect();
      if (select) {
        select.errorState = this.districtRequired();
        select.stateChanges.next();
      }
    });
  }

  protected onAddressInput(event: Event): void {
    this.state.handleAddressInput(readInputValue(event), DISTRICT_SEARCH_DEBOUNCE_MS);
  }

  protected onAddressPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    this.state.handleAddressPaste(pasted);
  }

  protected onDistrictChange(station: PoliceStation): void {
    this.state.setSelectedStation(station);
  }

  protected locateUser(): Promise<void> {
    return this.state.locateUser();
  }

  markAsTouched(): void {
    this.state.markLocationTouched();
  }
}
