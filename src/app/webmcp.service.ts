import { isPlatformBrowser } from '@angular/common';
import { Injectable, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { ADDRESS_MAX_LENGTH } from './domain/address.utils';
import { composeSmsMessage } from './domain/sms-message.utils';
import {
  LICENSE_PLATE_MAX_LENGTH,
  VIOLATION_MAX_LENGTH,
  VIOLATION_TYPES,
  cleanLicensePlate,
} from './domain/violation.utils';
import { ZH_TW } from './i18n';
import {
  District,
  POLICE_STATIONS,
  StationLookupService,
  type PoliceStation,
} from './police-stations';
import { SmsService } from './sms.service';

const DISTRICT_VALUES = Object.values(District);

type JsonSchemaType = 'array' | 'boolean' | 'number' | 'object' | 'string';
type StationSource = 'address' | 'district';
type WebMcpErrorCode =
  | 'address_too_long'
  | 'invalid_district'
  | 'license_plate_too_long'
  | 'missing_address'
  | 'missing_lookup_input'
  | 'missing_violation'
  | 'station_not_found'
  | 'violation_too_long';

interface JsonSchemaProperty {
  readonly type: JsonSchemaType;
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly items?: JsonSchemaProperty;
  readonly maxLength?: number;
  readonly minLength?: number;
}

interface JsonSchemaObject {
  readonly type: 'object';
  readonly additionalProperties?: boolean;
  readonly anyOf?: readonly { readonly required: readonly string[] }[];
  readonly properties: Record<string, JsonSchemaProperty>;
  readonly required?: readonly string[];
}

export interface WebMcpToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchemaObject;
  readonly execute: (input?: unknown) => WebMcpToolResult;
}

interface RegisterToolOptions {
  readonly signal?: AbortSignal;
}

interface ModelContext {
  provideContext?(context: { tools: WebMcpToolDefinition[] }): void;
  registerTool?(tool: WebMcpToolDefinition, options?: RegisterToolOptions): void;
}

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

interface StationData {
  readonly district: District;
  readonly stationName: string;
  readonly phoneNumber: string;
}

interface WebMcpFailure {
  readonly ok: false;
  readonly error: {
    readonly code: WebMcpErrorCode;
    readonly message: string;
  };
}

interface ListViolationTypesResult {
  readonly ok: true;
  readonly violationTypes: readonly string[];
  readonly districts: readonly string[];
  readonly constraints: {
    readonly addressMaxLength: number;
    readonly licensePlateMaxLength: number;
    readonly violationMaxLength: number;
    readonly customViolationsAllowed: true;
  };
}

interface LookupPoliceStationResult {
  readonly ok: true;
  readonly source: StationSource;
  readonly station: StationData;
  readonly addressMatchedStation?: StationData | null;
  readonly districtMismatch?: boolean;
}

interface GenerateSmsReportResult {
  readonly ok: true;
  readonly report: {
    readonly address: string;
    readonly violation: string;
    readonly licensePlate: string | null;
    readonly message: string;
    readonly phoneNumber: string;
    readonly smsLink: string;
    readonly station: StationData;
    readonly stationSource: StationSource;
    readonly addressMatchedStation: StationData | null;
    readonly districtMismatch: boolean;
  };
}

type WebMcpToolResult =
  | GenerateSmsReportResult
  | ListViolationTypesResult
  | LookupPoliceStationResult
  | WebMcpFailure;
type WebMcpInputKey = 'address' | 'district' | 'licensePlate' | 'violation';

function isInputRecord(input: unknown): input is Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function isModelContext(input: unknown): input is ModelContext {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const modelContext = input as ModelContext;
  return (
    typeof modelContext.registerTool === 'function' ||
    typeof modelContext.provideContext === 'function'
  );
}

function isDistrict(value: string): value is District {
  return DISTRICT_VALUES.includes(value as District);
}

@Injectable({ providedIn: 'root' })
export class WebMcpService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly smsService = inject(SmsService);
  private readonly stationLookup = inject(StationLookupService);
  private readonly registeredState = signal(false);
  private registrationAbortController: AbortController | null = null;

  readonly registered = this.registeredState.asReadonly();

  init(): void {
    if (this.registeredState()) return;
    if (!isPlatformBrowser(this.platformId)) return;

    const modelContext = this.modelContext();
    if (!modelContext) return;

    const tools = this.createTools();

    if (typeof modelContext.registerTool === 'function') {
      const abortController = new AbortController();
      for (const tool of tools) {
        modelContext.registerTool(tool, { signal: abortController.signal });
      }
      this.registrationAbortController = abortController;
      this.registeredState.set(true);
      return;
    }

    if (typeof modelContext.provideContext !== 'function') return;

    modelContext.provideContext({ tools });
    this.registeredState.set(true);
  }

  ngOnDestroy(): void {
    this.registrationAbortController?.abort();
    this.registrationAbortController = null;
    this.registeredState.set(false);
  }

  private createTools(): WebMcpToolDefinition[] {
    return [
      {
        name: 'generate_sms_report',
        description: ZH_TW.webmcp.generateSmsReportDescription,
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: ZH_TW.webmcp.addressDescription,
              minLength: 1,
              maxLength: ADDRESS_MAX_LENGTH,
            },
            violation: {
              type: 'string',
              description: ZH_TW.webmcp.violationDescription,
              minLength: 1,
              maxLength: VIOLATION_MAX_LENGTH,
            },
            licensePlate: {
              type: 'string',
              description: ZH_TW.webmcp.licensePlateDescription,
              maxLength: LICENSE_PLATE_MAX_LENGTH,
            },
            district: {
              type: 'string',
              description: ZH_TW.webmcp.districtDescription,
              enum: DISTRICT_VALUES,
            },
          },
          required: ['address', 'violation'],
          additionalProperties: false,
        },
        execute: (input) => this.generateSmsReport(input),
      },
      {
        name: 'list_supported_violation_types',
        description: ZH_TW.webmcp.listViolationTypesDescription,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        execute: () => this.listSupportedViolationTypes(),
      },
      {
        name: 'lookup_police_station',
        description: ZH_TW.webmcp.lookupPoliceStationDescription,
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: ZH_TW.webmcp.addressDescription,
              minLength: 1,
              maxLength: ADDRESS_MAX_LENGTH,
            },
            district: {
              type: 'string',
              description: ZH_TW.webmcp.districtDescription,
              enum: DISTRICT_VALUES,
            },
          },
          anyOf: [{ required: ['address'] }, { required: ['district'] }],
          additionalProperties: false,
        },
        execute: (input) => this.lookupPoliceStation(input),
      },
    ];
  }

  private listSupportedViolationTypes(): ListViolationTypesResult {
    return {
      ok: true,
      violationTypes: [...VIOLATION_TYPES],
      districts: [...DISTRICT_VALUES],
      constraints: {
        addressMaxLength: ADDRESS_MAX_LENGTH,
        licensePlateMaxLength: LICENSE_PLATE_MAX_LENGTH,
        violationMaxLength: VIOLATION_MAX_LENGTH,
        customViolationsAllowed: true,
      },
    };
  }

  private lookupPoliceStation(input: unknown): LookupPoliceStationResult | WebMcpFailure {
    const args = this.inputRecord(input);
    const address = this.optionalString(args, 'address');
    const district = this.optionalString(args, 'district');

    if (!address && !district) {
      return this.failure('missing_lookup_input', ZH_TW.webmcp.missingLookupInput);
    }

    if (address && address.length > ADDRESS_MAX_LENGTH) {
      return this.failure('address_too_long', ZH_TW.webmcp.addressTooLong);
    }

    const selectedDistrict = district && isDistrict(district) ? district : null;

    if (district && !selectedDistrict) {
      return this.failure('invalid_district', ZH_TW.webmcp.invalidDistrict);
    }

    const addressMatchedStation = address ? this.stationLookup.findStation(address) : null;

    if (selectedDistrict) {
      const station = this.findStationByDistrict(selectedDistrict);
      if (!station) return this.failure('station_not_found', ZH_TW.webmcp.stationNotFound);

      return {
        ok: true,
        source: 'district',
        station: this.toStationData(station),
        addressMatchedStation: this.toStationDataOrNull(addressMatchedStation),
        districtMismatch:
          !!addressMatchedStation && addressMatchedStation.district !== station.district,
      };
    }

    if (!addressMatchedStation) {
      return this.failure('station_not_found', ZH_TW.webmcp.stationNotFound);
    }

    return {
      ok: true,
      source: 'address',
      station: this.toStationData(addressMatchedStation),
    };
  }

  private generateSmsReport(input: unknown): GenerateSmsReportResult | WebMcpFailure {
    const args = this.inputRecord(input);
    const address = this.optionalString(args, 'address');
    const violation = this.optionalString(args, 'violation');
    const district = this.optionalString(args, 'district');

    if (!address) return this.failure('missing_address', ZH_TW.webmcp.missingAddress);
    if (address.length > ADDRESS_MAX_LENGTH) {
      return this.failure('address_too_long', ZH_TW.webmcp.addressTooLong);
    }

    if (!violation) return this.failure('missing_violation', ZH_TW.webmcp.missingViolation);
    if (violation.length > VIOLATION_MAX_LENGTH) {
      return this.failure('violation_too_long', ZH_TW.webmcp.violationTooLong);
    }

    const selectedDistrict = district && isDistrict(district) ? district : null;

    if (district && !selectedDistrict) {
      return this.failure('invalid_district', ZH_TW.webmcp.invalidDistrict);
    }

    const rawLicensePlate = this.optionalString(args, 'licensePlate') ?? '';
    const licensePlate = cleanLicensePlate(rawLicensePlate);
    if (licensePlate.length > LICENSE_PLATE_MAX_LENGTH) {
      return this.failure('license_plate_too_long', ZH_TW.webmcp.licensePlateTooLong);
    }

    const addressMatchedStation = this.stationLookup.findStation(address);
    const station = selectedDistrict
      ? this.findStationByDistrict(selectedDistrict)
      : addressMatchedStation;
    if (!station) return this.failure('station_not_found', ZH_TW.webmcp.stationNotFound);

    const message = composeSmsMessage({ address, violation, licensePlate });
    const smsLink = this.smsService.generateSmsLink(station.phoneNumber, message);

    return {
      ok: true,
      report: {
        address,
        violation,
        licensePlate: licensePlate || null,
        message,
        phoneNumber: station.phoneNumber,
        smsLink,
        station: this.toStationData(station),
        stationSource: selectedDistrict ? 'district' : 'address',
        addressMatchedStation: this.toStationDataOrNull(addressMatchedStation),
        districtMismatch:
          !!addressMatchedStation && addressMatchedStation.district !== station.district,
      },
    };
  }

  private modelContext(): ModelContext | null {
    const modelContext = globalThis.navigator?.modelContext;
    return isModelContext(modelContext) ? modelContext : null;
  }

  private inputRecord(input: unknown): Record<string, unknown> {
    return isInputRecord(input) ? input : {};
  }

  private optionalString(input: Record<string, unknown>, key: WebMcpInputKey): string | null {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (!descriptor || !('value' in descriptor)) return null;

    const value = descriptor.value;
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    return trimmed || null;
  }

  private findStationByDistrict(district: District): PoliceStation | null {
    return POLICE_STATIONS.find((station) => station.district === district) ?? null;
  }

  private toStationData(station: PoliceStation): StationData {
    return {
      district: station.district,
      stationName: station.stationName,
      phoneNumber: station.phoneNumber,
    };
  }

  private toStationDataOrNull(station: PoliceStation | null): StationData | null {
    return station ? this.toStationData(station) : null;
  }

  private failure(code: WebMcpErrorCode, message: string): WebMcpFailure {
    return {
      ok: false,
      error: { code, message },
    };
  }
}
