import { Injectable } from '@angular/core';
import { findStationByAddress } from './domain/address.utils';
import type { PoliceStation } from './domain/police-stations';

export { District, POLICE_STATIONS } from './domain/police-stations';
export type { PoliceStation } from './domain/police-stations';
export { normalizeAddress, findStationByAddress } from './domain/address.utils';

@Injectable({ providedIn: 'root' })
export class StationLookupService {
  private lastInput: string | undefined;
  private lastResult: PoliceStation | null = null;

  findStation(address: string): PoliceStation | null {
    if (address === this.lastInput) return this.lastResult;
    this.lastInput = address;
    this.lastResult = findStationByAddress(address);
    return this.lastResult;
  }
}
