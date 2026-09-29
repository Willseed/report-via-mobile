import { isPlatformBrowser } from '@angular/common';
import { Injectable, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { ADDRESS_MAX_LENGTH, normalizeAddress } from './domain/address.utils';
import {
  LICENSE_PLATE_MAX_LENGTH,
  LICENSE_PLATE_PATTERN,
  VIOLATION_MAX_LENGTH,
  VIOLATION_TYPES,
  cleanLicensePlate,
} from './domain/violation.utils';
import { GeocodingService } from './geocoding.service';
import { ZH_TW } from './i18n';
import {
  District,
  POLICE_STATIONS,
  StationLookupService,
  type PoliceStation,
} from './police-stations';
import { SmsService } from './sms.service';
import { LocationResolverService } from './services/location-resolver.service';
import { MessageComposerService } from './services/message-composer.service';
import { ReportDraftService } from './services/report-draft.service';
import { ReportFormService } from './services/report-form.service';
import { SmsSubmissionService } from './services/sms-submission.service';

const DISTRICT_VALUES = Object.values(District);
const MAX_PLATES = ZH_TW.webmcp.maxPlates;

type JsonSchemaType = 'array' | 'boolean' | 'number' | 'object' | 'string';
type StationSource = 'address' | 'coordinates' | 'district';
type WebMcpErrorCode =
  | 'address_too_long'
  | 'coordinate_lookup_failed'
  | 'invalid_coordinates'
  | 'invalid_address'
  | 'invalid_district'
  | 'invalid_form'
  | 'invalid_plates'
  | 'invalid_violation'
  | 'district_mismatch'
  | 'license_plate_too_long'
  | 'missing_address'
  | 'missing_lookup_input'
  | 'missing_station'
  | 'missing_violation'
  | 'station_not_found'
  | 'too_many_plates'
  | 'violation_too_long';

interface JsonSchemaProperty {
  readonly type: JsonSchemaType;
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly items?: JsonSchemaProperty;
  readonly maxItems?: number;
  readonly maxLength?: number;
  readonly maximum?: number;
  readonly minItems?: number;
  readonly minLength?: number;
  readonly minimum?: number;
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
  readonly execute: (input?: unknown) => WebMcpToolResult | Promise<WebMcpToolResult>;
}

interface RegisterToolOptions {
  readonly signal?: AbortSignal;
}

interface ModelContext {
  provideContext?(context: { tools: WebMcpToolDefinition[] }): void;
  registerTool?(tool: WebMcpToolDefinition, options?: RegisterToolOptions): void;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }

  interface Navigator {
    modelContext?: ModelContext;
  }
}

interface StationData {
  readonly district: District;
  readonly stationName: string;
  readonly phoneNumber: string;
}

interface FormData {
  readonly address: string;
  readonly district: District | null;
  readonly violation: string;
  readonly plates: readonly string[];
  readonly station: StationData | null;
}

interface WebMcpFailure {
  readonly ok: false;
  readonly error: {
    readonly code: WebMcpErrorCode;
    readonly message: string;
  };
  readonly opened?: false;
  readonly warnings?: readonly string[];
}

export interface ListViolationTypesResult {
  readonly ok: true;
  readonly violationTypes: readonly string[];
  readonly districts: readonly string[];
  readonly constraints: {
    readonly addressMaxLength: number;
    readonly licensePlateMaxLength: number;
    readonly maxPlates: number;
    readonly violationMaxLength: number;
    readonly customViolationsAllowed: true;
  };
}

export interface LookupStationResult {
  readonly ok: true;
  readonly source: StationSource;
  readonly station: StationData;
  readonly addressMatchedStation?: StationData | null;
  readonly districtMismatch?: boolean;
  readonly address?: string;
}

export interface SetReportFormResult {
  readonly ok: true;
  readonly form: FormData;
  readonly changed: readonly string[];
}

export interface PreviewSmsResult {
  readonly ok: true;
  readonly to: string;
  readonly body: string;
  readonly station: StationData;
  readonly warnings: readonly string[];
}

export interface OpenSmsComposerResult {
  readonly ok: true;
  readonly opened: boolean;
  readonly to: string;
  readonly body: string;
  readonly station: StationData;
  readonly warnings: readonly string[];
  readonly reason?: 'composer_open_failed' | 'draft_changed' | 'user_confirmation_required';
}

export type WebMcpToolResult =
  | ListViolationTypesResult
  | LookupStationResult
  | SetReportFormResult
  | PreviewSmsResult
  | OpenSmsComposerResult
  | WebMcpFailure;

type WebMcpInputKey = 'address' | 'district' | 'lat' | 'lng' | 'plates' | 'violation';

interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

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
  private readonly geocoding = inject(GeocodingService);
  private readonly form = inject(ReportFormService);
  private readonly location = inject(LocationResolverService);
  private readonly composer = inject(MessageComposerService);
  private readonly draft = inject(ReportDraftService);
  private readonly smsService = inject(SmsService);
  private readonly submission = inject(SmsSubmissionService);
  private readonly stationLookup = inject(StationLookupService);
  private readonly registeredState = signal(false);
  private registrationAbortController: AbortController | null = null;
  private unavailableLogged = false;

  readonly registered = this.registeredState.asReadonly();

  init(): void {
    if (this.registeredState()) return;
    if (!isPlatformBrowser(this.platformId)) return;

    const modelContext = this.modelContext();
    if (!modelContext) {
      if (!this.unavailableLogged) {
        console.info('WebMCP is unavailable; continuing without browser tools.');
        this.unavailableLogged = true;
      }
      return;
    }

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
        name: 'list_violation_types',
        description: ZH_TW.webmcp.listViolationTypesDescription,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        execute: () => this.listViolationTypes(),
      },
      {
        name: 'lookup_station',
        description: ZH_TW.webmcp.lookupStationDescription,
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
            lat: {
              type: 'number',
              description: ZH_TW.webmcp.latitudeDescription,
              minimum: -90,
              maximum: 90,
            },
            lng: {
              type: 'number',
              description: ZH_TW.webmcp.longitudeDescription,
              minimum: -180,
              maximum: 180,
            },
          },
          anyOf: [
            { required: ['address'] },
            { required: ['district'] },
            { required: ['lat', 'lng'] },
          ],
          additionalProperties: false,
        },
        execute: (input) => this.lookupStation(input),
      },
      {
        name: 'set_report_form',
        description: ZH_TW.webmcp.setReportFormDescription,
        inputSchema: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
              description: ZH_TW.webmcp.addressDescription,
              maxLength: ADDRESS_MAX_LENGTH,
            },
            district: {
              type: 'string',
              description: ZH_TW.webmcp.districtDescription,
              enum: DISTRICT_VALUES,
            },
            violation: {
              type: 'string',
              description: ZH_TW.webmcp.violationDescription,
              maxLength: VIOLATION_MAX_LENGTH,
            },
            plates: {
              type: 'array',
              description: ZH_TW.webmcp.platesDescription,
              minItems: 0,
              maxItems: MAX_PLATES,
              items: {
                type: 'string',
                description: ZH_TW.webmcp.licensePlateDescription,
                maxLength: LICENSE_PLATE_MAX_LENGTH,
              },
            },
          },
          additionalProperties: false,
        },
        execute: (input) => this.setReportForm(input),
      },
      {
        name: 'preview_sms',
        description: ZH_TW.webmcp.previewSmsDescription,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        execute: () => this.previewSms(),
      },
      {
        name: 'open_sms_composer',
        description: ZH_TW.webmcp.openSmsComposerDescription,
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
        execute: () => this.openSmsComposer(),
      },
    ];
  }

  private listViolationTypes(): ListViolationTypesResult {
    return {
      ok: true,
      violationTypes: [...VIOLATION_TYPES],
      districts: [...DISTRICT_VALUES],
      constraints: {
        addressMaxLength: ADDRESS_MAX_LENGTH,
        licensePlateMaxLength: LICENSE_PLATE_MAX_LENGTH,
        maxPlates: MAX_PLATES,
        violationMaxLength: VIOLATION_MAX_LENGTH,
        customViolationsAllowed: true,
      },
    };
  }

  private lookupStation(
    input: unknown,
  ): LookupStationResult | WebMcpFailure | Promise<WebMcpToolResult> {
    const args = this.inputRecord(input);
    const suppliedAddress = this.optionalString(args, 'address');
    const suppliedDistrict = this.optionalString(args, 'district');
    const coordinates = this.readCoordinates(args);
    const hasLookupArgument =
      this.hasDataProperty(args, 'address') ||
      this.hasDataProperty(args, 'district') ||
      this.hasDataProperty(args, 'lat') ||
      this.hasDataProperty(args, 'lng');
    const address =
      suppliedAddress ?? (!hasLookupArgument ? this.form.address().trim() || null : null);
    const district = suppliedDistrict ?? (!hasLookupArgument ? this.form.district() : null);

    if (coordinates === 'invalid') {
      return this.failure('invalid_coordinates', ZH_TW.webmcp.invalidCoordinates);
    }

    if (!address && !district && !coordinates) {
      return this.failure('missing_lookup_input', ZH_TW.webmcp.missingLookupInput);
    }

    if (address && address.length > ADDRESS_MAX_LENGTH) {
      return this.failure('address_too_long', ZH_TW.webmcp.addressTooLong);
    }

    const selectedDistrict = district && isDistrict(district) ? district : null;

    if (district && !selectedDistrict) {
      return this.failure('invalid_district', ZH_TW.webmcp.invalidDistrict);
    }

    if (selectedDistrict) {
      return this.lookupByDistrict(selectedDistrict, address);
    }

    if (address) {
      return this.lookupByAddress(address, 'address');
    }

    if (!coordinates || !this.hasCoordinatePair(args)) {
      return this.failure('invalid_coordinates', ZH_TW.webmcp.invalidCoordinates);
    }

    return this.geocoding
      .reverseGeocode(coordinates.lat, coordinates.lng)
      .then((resolvedAddress) => this.lookupByAddress(resolvedAddress, 'coordinates'))
      .catch(() => this.failure('coordinate_lookup_failed', ZH_TW.webmcp.coordinateLookupFailed));
  }

  private setReportForm(input: unknown): SetReportFormResult | WebMcpFailure {
    const args = this.inputRecord(input);
    const changed: string[] = [];
    let nextAddress: string | undefined;
    let nextStation: PoliceStation | null | undefined;
    let nextViolation: string | undefined;
    let nextPlates: readonly string[] | undefined;

    if (this.hasDataProperty(args, 'address')) {
      const address = this.ownValue(args, 'address');
      if (typeof address !== 'string') {
        return this.failure('invalid_address', ZH_TW.webmcp.invalidAddress);
      }

      nextAddress = normalizeAddress(address.trim());
      if (nextAddress.length > ADDRESS_MAX_LENGTH) {
        return this.failure('address_too_long', ZH_TW.webmcp.addressTooLong);
      }
      nextStation = nextAddress ? this.stationLookup.findStation(nextAddress) : null;
      changed.push('address');
    }

    if (this.hasDataProperty(args, 'district')) {
      const district = this.ownValue(args, 'district');
      const districtValue = typeof district === 'string' ? district.trim() : '';
      if (!isDistrict(districtValue)) {
        return this.failure('invalid_district', ZH_TW.webmcp.invalidDistrict);
      }

      const station = this.findStationByDistrict(districtValue);
      if (!station) return this.failure('station_not_found', ZH_TW.webmcp.stationNotFound);
      nextStation = station;
      changed.push('district');
    }

    if (this.hasDataProperty(args, 'violation')) {
      const violation = this.ownValue(args, 'violation');
      if (typeof violation !== 'string') {
        return this.failure('invalid_violation', ZH_TW.webmcp.invalidViolation);
      }
      nextViolation = violation.trim();
      if (nextViolation.length > VIOLATION_MAX_LENGTH) {
        return this.failure('violation_too_long', ZH_TW.webmcp.violationTooLong);
      }
      changed.push('violation');
    }

    if (this.hasDataProperty(args, 'plates')) {
      const plates = this.readPlates(args);
      if (plates === 'invalid') return this.failure('invalid_plates', ZH_TW.webmcp.invalidPlates);
      if (plates === 'too_many') {
        return this.failure('too_many_plates', ZH_TW.webmcp.tooManyPlates);
      }
      if (plates === 'too_long') {
        return this.failure('license_plate_too_long', ZH_TW.webmcp.licensePlateTooLong);
      }
      nextPlates = plates;
      changed.push('plates');
    }

    this.location.clearAddressDebounce();
    this.form.clearViolationDebounce();
    if (nextAddress !== undefined) this.form.setAddress(nextAddress);
    if (nextStation !== undefined) this.form.setSelectedStation(nextStation);
    if (nextViolation !== undefined) this.form.setViolation(nextViolation);
    if (nextPlates !== undefined) {
      this.form.setLicensePlates(nextPlates);
      if (nextPlates.length > 0) this.form.showLicensePlateField();
    }

    return {
      ok: true,
      form: this.currentFormData(),
      changed,
    };
  }

  private previewSms(): PreviewSmsResult | WebMcpFailure {
    const preview = this.buildPreview();
    if (!preview.ok) return preview;
    return preview;
  }

  private async openSmsComposer(): Promise<OpenSmsComposerResult | WebMcpFailure> {
    const preview = this.buildPreview();
    if (!preview.ok) return { ...preview, opened: false };

    const snapshot: PreviewSmsResult = {
      ...preview,
      station: { ...preview.station },
      warnings: [...preview.warnings],
    };
    const confirmed = await this.submission.confirmDraft({
      stationName: snapshot.station.stationName,
      phoneNumber: snapshot.to,
      message: snapshot.body,
      licensePlate: this.form.licensePlate() || undefined,
      warnings: snapshot.warnings,
    });
    if (!confirmed) {
      return {
        ok: true,
        opened: false,
        to: snapshot.to,
        body: snapshot.body,
        station: snapshot.station,
        warnings: [...snapshot.warnings, ZH_TW.webmcp.confirmationRequired],
        reason: 'user_confirmation_required',
      };
    }

    const current = this.buildPreview();
    if (!current.ok || !this.samePreview(snapshot, current)) {
      return {
        ok: true,
        opened: false,
        to: snapshot.to,
        body: snapshot.body,
        station: snapshot.station,
        warnings: [...snapshot.warnings, ZH_TW.webmcp.draftChanged],
        reason: 'draft_changed',
      };
    }

    try {
      const opened = this.smsService.openSmsComposer(snapshot.to, snapshot.body);
      return {
        ok: true,
        opened,
        to: snapshot.to,
        body: snapshot.body,
        station: snapshot.station,
        warnings: snapshot.warnings,
        ...(opened ? {} : { reason: 'composer_open_failed' as const }),
      };
    } catch {
      return {
        ok: true,
        opened: false,
        to: snapshot.to,
        body: snapshot.body,
        station: snapshot.station,
        warnings: snapshot.warnings,
        reason: 'composer_open_failed',
      };
    }
  }

  private buildPreview(): PreviewSmsResult | WebMcpFailure {
    const address = this.form.address().trim();
    const violation = this.form.violation().trim();
    const station = this.form.station();
    const plates = this.form.licensePlates();

    if (!address) return this.failure('missing_address', ZH_TW.webmcp.missingAddress);
    if (address.length > ADDRESS_MAX_LENGTH) {
      return this.failure('address_too_long', ZH_TW.webmcp.addressTooLong);
    }
    if (!violation) return this.failure('missing_violation', ZH_TW.webmcp.missingViolation);
    if (violation.length > VIOLATION_MAX_LENGTH) {
      return this.failure('violation_too_long', ZH_TW.webmcp.violationTooLong);
    }
    if (!station) return this.failure('missing_station', ZH_TW.webmcp.missingStation);
    if (plates.length > MAX_PLATES) {
      return this.failure('too_many_plates', ZH_TW.webmcp.tooManyPlates);
    }
    if (plates.some((plate) => plate.length > LICENSE_PLATE_MAX_LENGTH)) {
      return this.failure('license_plate_too_long', ZH_TW.webmcp.licensePlateTooLong);
    }
    if (plates.some((plate) => !LICENSE_PLATE_PATTERN.test(plate))) {
      return this.failure('invalid_plates', ZH_TW.webmcp.invalidPlates);
    }
    if (this.composer.districtMismatch()) {
      return this.failure('district_mismatch', ZH_TW.webmcp.districtMismatch);
    }
    const draft = this.draft.submitData();
    if (!this.draft.isFormValid() || !draft) {
      return this.failure('invalid_form', ZH_TW.webmcp.invalidForm);
    }

    return {
      ok: true,
      to: draft.phoneNumber,
      body: draft.message,
      station: this.toStationData(station),
      warnings: [...ZH_TW.webmcp.previewWarnings],
    };
  }

  private samePreview(a: PreviewSmsResult, b: PreviewSmsResult): boolean {
    return (
      a.to === b.to &&
      a.body === b.body &&
      a.station.district === b.station.district &&
      a.station.stationName === b.station.stationName &&
      a.station.phoneNumber === b.station.phoneNumber
    );
  }

  private lookupByDistrict(
    district: District,
    address: string | null,
  ): LookupStationResult | WebMcpFailure {
    const station = this.findStationByDistrict(district);
    if (!station) return this.failure('station_not_found', ZH_TW.webmcp.stationNotFound);

    const addressMatchedStation = address ? this.stationLookup.findStation(address) : null;
    return {
      ok: true,
      source: 'district',
      station: this.toStationData(station),
      addressMatchedStation: this.toStationDataOrNull(addressMatchedStation),
      districtMismatch:
        !!addressMatchedStation && addressMatchedStation.district !== station.district,
      ...(address ? { address } : {}),
    };
  }

  private lookupByAddress(
    address: string,
    source: Exclude<StationSource, 'district'>,
  ): LookupStationResult | WebMcpFailure {
    const addressMatchedStation = this.stationLookup.findStation(address);
    if (!addressMatchedStation) {
      return this.failure('station_not_found', ZH_TW.webmcp.stationNotFound);
    }

    return {
      ok: true,
      source,
      station: this.toStationData(addressMatchedStation),
      address: normalizeAddress(address),
    };
  }

  private modelContext(): ModelContext | null {
    const documentModelContext = globalThis.document?.modelContext;
    if (isModelContext(documentModelContext)) return documentModelContext;

    const navigatorModelContext = globalThis.navigator?.modelContext;
    return isModelContext(navigatorModelContext) ? navigatorModelContext : null;
  }

  private inputRecord(input: unknown): Record<string, unknown> {
    return isInputRecord(input) ? input : {};
  }

  private optionalString(input: Record<string, unknown>, key: WebMcpInputKey): string | null {
    const value = this.ownValue(input, key);
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    return trimmed || null;
  }

  private readCoordinates(input: Record<string, unknown>): Coordinates | 'invalid' | null {
    const lat = this.ownValue(input, 'lat');
    const lng = this.ownValue(input, 'lng');
    const hasLat = lat !== undefined;
    const hasLng = lng !== undefined;

    if (!hasLat && !hasLng) return null;
    if (typeof lat !== 'number' || typeof lng !== 'number') return 'invalid';
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'invalid';
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'invalid';
    return { lat, lng };
  }

  private hasCoordinatePair(input: Record<string, unknown>): boolean {
    return this.hasDataProperty(input, 'lat') && this.hasDataProperty(input, 'lng');
  }

  private readPlates(
    input: Record<string, unknown>,
  ): readonly string[] | 'invalid' | 'too_many' | 'too_long' {
    const value = this.ownValue(input, 'plates');
    if (!Array.isArray(value)) return 'invalid';
    if (value.length > MAX_PLATES) return 'too_many';

    const plates: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !('value' in descriptor) || typeof descriptor.value !== 'string') {
        return 'invalid';
      }
      if (descriptor.value.length > LICENSE_PLATE_MAX_LENGTH) return 'too_long';
      const cleaned = cleanLicensePlate(descriptor.value);
      if (cleaned) plates.push(cleaned);
    }
    return plates;
  }

  private hasDataProperty(input: Record<string, unknown>, key: WebMcpInputKey): boolean {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    return !!descriptor && 'value' in descriptor;
  }

  private ownValue(input: Record<string, unknown>, key: WebMcpInputKey): unknown {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    return descriptor && 'value' in descriptor ? descriptor.value : undefined;
  }

  private currentFormData(): FormData {
    const station = this.form.station();
    return {
      address: this.form.address(),
      district: this.form.district(),
      violation: this.form.violation(),
      plates: [...this.form.licensePlates()],
      station: station ? this.toStationData(station) : null,
    };
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
