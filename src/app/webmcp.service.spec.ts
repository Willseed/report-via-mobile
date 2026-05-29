import { Platform } from '@angular/cdk/platform';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { District } from './police-stations';
import { WebMcpService, type WebMcpToolDefinition } from './webmcp.service';
import { VIOLATION_TYPES } from './domain/violation.utils';

interface ModelContextMock {
  provideContext?: ReturnType<typeof vi.fn>;
  registerTool?: ReturnType<typeof vi.fn>;
}

function setModelContext(modelContext: unknown): void {
  Object.defineProperty(navigator, 'modelContext', {
    configurable: true,
    value: modelContext,
  });
}

function clearModelContext(): void {
  delete (navigator as Navigator & { modelContext?: ModelContextMock }).modelContext;
}

function configureService(
  modelContext?: unknown,
  platformId: 'browser' | 'server' = 'browser',
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
    ],
  });

  return TestBed.inject(WebMcpService);
}

function registeredTools(modelContext: ModelContextMock): WebMcpToolDefinition[] {
  if (modelContext.registerTool) {
    return modelContext.registerTool.mock.calls.map(
      ([tool]) => tool as WebMcpToolDefinition,
    );
  }

  const context = modelContext.provideContext?.mock.calls[0]?.[0] as
    | { tools: WebMcpToolDefinition[] }
    | undefined;

  if (!context) throw new Error('Expected WebMCP context to be registered.');
  return context.tools;
}

function findTool(tools: WebMcpToolDefinition[], name: string): WebMcpToolDefinition {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) throw new Error(`Expected ${name} WebMCP tool.`);
  return tool;
}

describe('WebMcpService', () => {
  afterEach(() => {
    clearModelContext();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('does not throw or register when navigator.modelContext is unavailable', () => {
    const service = configureService();

    expect(() => service.init()).not.toThrow();
    expect(service.registered()).toBe(false);
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

  it('registers WebMCP tools with schemas', () => {
    const modelContext = { registerTool: vi.fn() };
    const service = configureService(modelContext);

    service.init();

    const tools = registeredTools(modelContext);
    expect(service.registered()).toBe(true);
    expect(modelContext.registerTool).toHaveBeenCalledTimes(3);
    expect(modelContext.registerTool.mock.calls).toSatisfy(
      (calls: unknown[][]) =>
        calls.every(([, options]) => options instanceof Object && 'signal' in options),
    );
    expect(tools.map((tool) => tool.name)).toEqual([
      'generate_sms_report',
      'list_supported_violation_types',
      'lookup_police_station',
    ]);
    expect(findTool(tools, 'generate_sms_report').inputSchema).toMatchObject({
      type: 'object',
      required: ['address', 'violation'],
      additionalProperties: false,
    });
  });

  it('falls back to provideContext when registerTool is unavailable', () => {
    const modelContext = { provideContext: vi.fn() };
    const service = configureService(modelContext);

    service.init();

    expect(service.registered()).toBe(true);
    expect(modelContext.provideContext).toHaveBeenCalledOnce();
    expect(registeredTools(modelContext).map((tool) => tool.name)).toContain(
      'generate_sms_report',
    );
  });

  it('executes registered tools using existing app services and data', () => {
    const modelContext = { registerTool: vi.fn() };
    const service = configureService(modelContext);
    const address = '臺北市信義區市府路1號';
    const violation = VIOLATION_TYPES[0];

    service.init();

    const tools = registeredTools(modelContext);
    const listResult = findTool(tools, 'list_supported_violation_types').execute();
    const lookupResult = findTool(tools, 'lookup_police_station').execute({ address });
    const reportResult = findTool(tools, 'generate_sms_report').execute({
      address,
      violation,
      licensePlate: 'abc-123',
    });
    const expectedMessage = [
      `${address}，有${violation}`,
      '車牌號碼：ABC123',
      '請派員處理',
    ].join('，');

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
    expect(reportResult).toMatchObject({
      ok: true,
      report: {
        address,
        violation,
        licensePlate: 'ABC123',
        message: expectedMessage,
        phoneNumber: '0911510914',
        smsLink: `sms:0911510914?body=${encodeURIComponent(expectedMessage)}`,
        station: {
          district: District.Taipei,
          stationName: '臺北市政府警察局',
          phoneNumber: '0911510914',
        },
        stationSource: 'address',
        districtMismatch: false,
      },
    });
  });

  it('only reads own data properties from tool inputs', () => {
    const modelContext = { registerTool: vi.fn() };
    const service = configureService(modelContext);
    const address = '臺北市信義區市府路1號';
    const violation = VIOLATION_TYPES[0];

    service.init();

    const reportTool = findTool(registeredTools(modelContext), 'generate_sms_report');
    const inheritedInput = Object.create({ address, violation });
    const accessorInput = Object.create(null, {
      address: {
        enumerable: true,
        get: () => {
          throw new Error('getter should not run');
        },
      },
      violation: {
        enumerable: true,
        value: violation,
      },
    });

    expect(reportTool.execute(inheritedInput)).toMatchObject({
      ok: false,
      error: { code: 'missing_address' },
    });
    expect(() => reportTool.execute(accessorInput)).not.toThrow();
    expect(reportTool.execute(accessorInput)).toMatchObject({
      ok: false,
      error: { code: 'missing_address' },
    });
  });
});
