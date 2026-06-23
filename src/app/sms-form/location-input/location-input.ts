import {
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
import { LocationWorkflowService } from '../../services/location-workflow.service';

export {
  ADDRESS_LOOKUP_DEBOUNCE_MS as DISTRICT_SEARCH_DEBOUNCE_MS,
} from '../../services/location-workflow.service';
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
})
export class LocationInput {
  private readonly workflow = inject(LocationWorkflowService);
  private readonly districtSelect = viewChild(MatSelect);

  protected readonly i18n = ZH_TW;
  protected readonly addressForm = this.workflow.addressForm;
  protected readonly stations = this.workflow.stations;
  protected readonly isManualAddress = this.workflow.isManualAddress;
  protected readonly isLocating = this.workflow.isLocating;
  protected readonly isOnline = this.workflow.isOnline;
  protected readonly locationError = this.workflow.locationError;
  protected readonly locationStatus = this.workflow.locationStatus;
  protected readonly compareStations = this.workflow.compareStations;

  readonly address = this.workflow.address;
  readonly district = this.workflow.station;
  readonly districtMismatch = this.workflow.hasDistrictMismatch;
  readonly valid = this.workflow.isAddressValid;
  readonly districtRequired = this.workflow.districtRequired;

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
    this.workflow.updateAddress(readInputValue(event));
  }

  protected onAddressPaste(event: ClipboardEvent): void {
    const pasted = event.clipboardData?.getData('text') ?? '';
    if (!pasted) return;
    this.workflow.updateManualAddress(pasted);
  }

  protected onDistrictChange(station: PoliceStation): void {
    this.workflow.updateStation(station);
  }

  protected locateUser(): Promise<void> {
    return this.workflow.locateUser();
  }

  markAsTouched(): void {
    this.workflow.markAsTouched();
  }
}
