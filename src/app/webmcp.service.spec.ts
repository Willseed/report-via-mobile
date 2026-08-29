import { Platform } from '@angular/cdk/platform';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIOLATION_TYPES } from './domain/violation.utils';
import { GeocodingService } from './geocoding.service';
import { District } from './police-stations';
import { SmsService } from './sms.service';
import { WebMcpService, type WebMcpToolDefinition } from './webmcp.service';

interface ModelContextMock {
  provideContext?: ReturnType<typeof vi.fn>;
  registerTool?: ReturnType<typeof vi.fn>;
}

interface SmsServiceMock {
  openSmsComposer: ReturnType<typeof vi.fn>;
}

const ADDRESS = '臺北市信義區市府路1號';
const VIOLATION = VIOLATION_TYPES[0];

function setModelContext(modelContext: unknown): void {
  Object.defineProperty(navigator, 'modelContext', {
    configurable: true,
    value: modelContext,
  });
}

function setDocumentModelContext(modelContext: unknown): void {
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: modelContext,
  });
}

function clearModelContext(): void {
  delete (navigator as Navigator & { modelContext?: ModelContextMock }).modelContext;
  delete (document as Document & { modelContext?: ModelContextMock }).modelContext;
}

function configureService(
  modelContext?: unknown,
  platformId: 'browser' | 'server' = 'browser',
  smsService?: SmsServiceMock,
  geocodingService?: Partial<Pick<GeocodingService, 'reverseGeocode'>>,
): WebMcpService {
  if (modelContext === undefined) {
    clearModelContext();
  } else {
    setModelContext(modelContext);
  }

  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: platformId },
      { provide: Platform, useValue: { ANDROID: true, IOS: false } as Platform },
      {
        provide: GeocodingService,
        useValue: {
          reverseGeocode: vi.fn(),
          ...geocodingService,
        },
      },
      ...(smsService ? [{ provide: SmsService, useValue: smsService }] : []),
    ],
  });

  return TestBed.inject(WebMcpService);
}

function configureWithSms(modelContext: unknown, smsService: SmsServiceMock): WebMcpService {
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: Platform, useValue: { ANDROID: true, IOS: false } as Platform },
      { provide: GeocodingService, useValue: { reverseGeocode: vi.fn() } },
      { provide: SmsService, useValue: smsService },
    ],
  });
  setModelContext(modelContext);
  return TestBed.inject(WebMcpService);
}

function registeredTools(modelContext: ModelContextMock): WebMcpToolDefinition[] {
  if (modelContext.registerTool) {
    return modelContext.registerTool.mock.calls.map(([tool]) => tool as WebMcpToolDefinition);
  }

  const context = modelContext.provideContext?.mock.calls[0]?.[0] as
    { tools: WebMcpToolDefinition[] } | undefined;

  if (!context) throw new Error('Expected WebMCP context to be registered.');
  return context.tools;
}

function findTool(tools: WebMcpToolDefinition[], name: string): WebMcpToolDefinition {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`Expected ${name} WebMCP tool.`);
  return tool;
}

function fillForm(tools: WebMcpToolDefinition[]): void {
  findTool(tools, 'set_report_form').execute({
    address: ADDRESS,
    district: District.Taipei,
    violation: VIOLATION,
    plates: ['abc-123'],
  });
}

describe('WebMcpService', () => {
  afterEach(() => {
    clearModelContext();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not throw or register when navigator.modelContext is unavailable', () => {
    const service = configureService();
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    expect(() => service.init()).not.toThrow();
    expect(service.registered()).toBe(false);
    service.init();
    expect(consoleInfo).toHaveBeenCalledOnce();
    expect(consoleInfo).toHaveBeenCalledWith(
      'WebMCP is unavailable; continuing without browser tools.',
    );
  });

  it('does not register when navigator.modelContext does not expose WebMCP methods', () => {
    const service = configureService({ registerTool: 'not a function' });

    expect(() => service.init()).not.toThrow();
    expect(service.registered()).toBe(false);
  });

  it('does not register outside browser contexts', () => {
    const modelContext = { registerTool: vi.fn() };
    const service = configureService(modelContext, 'server');

    service.init();

    expect(modelContext.registerTool).not.toHaveBeenCalled();
    expect(service.registered()).toBe(false);
  });

  it('registers exactly the five browser WebMCP tools with safe descriptions', () => {
    const modelContext = { registerTool: vi.fn() };
    const service = configureService(modelContext);

    service.init();

    const tools = registeredTools(modelContext);
    expect(service.registered()).toBe(true);
    expect(modelContext.registerTool).toHaveBeenCalledTimes(5);
    expect(modelContext.registerTool.mock.calls).toSatisfy((calls: unknown[][]) =>
      calls.every(([, options]) => options instanceof Object && 'signal' in options),
    );
    expect(tools.map((tool) => tool.name)).toEqual([
      'list_violation_types',
      'lookup_station',
      'set_report_form',
      'preview_sms',
      'open_sms_composer',
    ]);
    expect(
      tools.every((tool) => tool.description.startsWith('Does not submit a police report.')),
    ).toBe(true);
    expect(tools.map((tool) => tool.name)).not.toContain('send_sms');
    expect(tools.map((tool) => tool.name)).not.toContain('submit_report');
    expect(findTool(tools, 'lookup_station').inputSchema).toMatchObject({
      type: 'object',
      additionalProperties: false,
      anyOf: [{ required: ['address'] }, { required: ['district'] }, { required: ['lat', 'lng'] }],
    });
    expect(findTool(tools, 'set_report_form').inputSchema.properties['plates']).toMatchObject({
      type: 'array',
    });
  });

  it('prefers the current document.modelContext API', () => {
    const modelContext = { registerTool: vi.fn() };
    configureService();
    setDocumentModelContext(modelContext);
    const service = TestBed.inject(WebMcpService);

    service.init();

    expect(modelContext.registerTool).toHaveBeenCalledTimes(5);
  });

  it('falls back to provideContext when registerTool is unavailable', () => {
    const modelContext = { provideContext: vi.fn() };
    const service = configureService(modelContext);

    service.init();

    expect(service.registered()).toBe(true);
    expect(modelContext.provideContext).toHaveBeenCalledOnce();
    expect(registeredTools(modelContext).map((tool) => tool.name)).toContain('preview_sms');
  });

  it('supports the list → lookup → set form → preview flow locally', () => {
    const modelContext = { registerTool: vi.fn() };
    const service = configureService(modelContext);
    service.init();
    const tools = registeredTools(modelContext);

    const listResult = findTool(tools, 'list_violation_types').execute();
    const lookupResult = findTool(tools, 'lookup_station').execute({ address: ADDRESS });
    const setResult = findTool(tools, 'set_report_form').execute({
      address: ADDRESS,
      district: District.Taipei,
      violation: VIOLATION,
      plates: ['abc-123'],
    });
    const previewResult = findTool(tools, 'preview_sms').execute();
    const expectedBody = [`${ADDRESS}，有${VIOLATION}`, '車牌號碼：ABC123', '請派員處理'].join(
      '，',
    );

    expect(listResult).toMatchObject({
      ok: true,
      violationTypes: VIOLATION_TYPES,
      districts: expect.arrayContaining([District.Taipei]),
    });
    expect(lookupResult).toMatchObject({
      ok: true,
      source: 'address',
      station: {
        district: District.Taipei,
        stationName: '臺北市政府警察局',
        phoneNumber: '0911510914',
      },
    });
    expect(setResult).toMatchObject({
      ok: true,
      form: {
        address: ADDRESS,
        district: District.Taipei,
        violation: VIOLATION,
        plates: ['ABC123'],
      },
    });
    expect(previewResult).toMatchObject({
      ok: true,
      to: '0911510914',
      body: expectedBody,
      station: {
        district: District.Taipei,
        stationName: '臺北市政府警察局',
        phoneNumber: '0911510914',
      },
    });
    if (!('warnings' in previewResult) || !previewResult.warnings) {
      throw new Error('Expected preview warnings.');
    }
    const warnings = previewResult.warnings;
    expect(warnings.some((warning) => warning.includes('尚未送出'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('非官方'))).toBe(true);
    expect(warnings.some((warning) => warning.includes('需使用者確認'))).toBe(true);
  });

  it('reverse-geocodes supplied coordinates without requesting GPS permission', async () => {
    const modelContext = { registerTool: vi.fn() };
    const reverseGeocode = vi.fn().mockResolvedValue(ADDRESS);
    const service = configureService(modelContext, 'browser', undefined, { reverseGeocode });
    service.init();

    const result = await findTool(registeredTools(modelContext), 'lookup_station').execute({
      lat: 25.033,
      lng: 121.565,
    });

    expect(reverseGeocode).toHaveBeenCalledWith(25.033, 121.565);
    expect(result).toMatchObject({
      ok: true,
      source: 'coordinates',
      station: { district: District.Taipei },
    });
  });

  it('does not open sms: when open_sms_composer has no confirmation', () => {
    const modelContext = { registerTool: vi.fn() };
    const smsService = { openSmsComposer: vi.fn().mockReturnValue(true) };
    const service = configureWithSms(modelContext, smsService);
    service.init();
    const tools = registeredTools(modelContext);
    fillForm(tools);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));

    const result = findTool(tools, 'open_sms_composer').execute();

    expect(result).toMatchObject({ ok: true, opened: false, reason: 'user_confirmation_required' });
    expect(smsService.openSmsComposer).not.toHaveBeenCalled();
  });

  it('opens the system SMS composer only after page confirmation', () => {
    const modelContext = { registerTool: vi.fn() };
    const smsService = { openSmsComposer: vi.fn().mockReturnValue(true) };
    const service = configureWithSms(modelContext, smsService);
    service.init();
    const tools = registeredTools(modelContext);
    fillForm(tools);
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

    const result = findTool(tools, 'open_sms_composer').execute();

    expect(result).toMatchObject({ ok: true, opened: true, to: '0911510914' });
    expect(smsService.openSmsComposer).toHaveBeenCalledWith(
      '0911510914',
      expect.stringContaining('ABC123'),
    );
  });

  it('only reads own data properties from tool inputs', () => {
    const modelContext = { registerTool: vi.fn() };
    const service = configureService(modelContext);
    service.init();

    const setTool = findTool(registeredTools(modelContext), 'set_report_form');
    const inheritedInput = Object.create({ address: ADDRESS, violation: VIOLATION });
    const accessorInput = Object.create(null, {
      address: {
        enumerable: true,
        get: () => {
          throw new Error('getter should not run');
        },
      },
      violation: {
        enumerable: true,
        value: VIOLATION,
      },
    });

    expect(setTool.execute(inheritedInput)).toMatchObject({ ok: true, changed: [] });
    expect(() => setTool.execute(accessorInput)).not.toThrow();
    expect(setTool.execute(accessorInput)).toMatchObject({ ok: true, changed: ['violation'] });
  });
});
