import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const converter = fileURLToPath(new URL('./zap-to-sarif.ts', import.meta.url));
const storageNote = '\nNote that this alert will only be raised once for each URL + key.';

function storageEvidence(value = 'auto', param = 'theme-preference') {
  return `The following data (key=value) was set: ${param}=${value}${storageNote}`;
}

function instance(overrides = {}) {
  return { uri: 'http://localhost:4200/#/', method: 'GET', ...overrides };
}

function alert(overrides = {}) {
  return {
    pluginid: '10055',
    alertRef: '10055-4',
    name: 'CSP: Wildcard Directive',
    desc: 'A wildcard appears in the policy.',
    solution: 'Use explicit trusted sources.',
    reference: '',
    riskcode: '2',
    instances: [instance({ param: 'Content-Security-Policy' })],
    ...overrides,
  };
}

function storageAlert(overrides = {}) {
  return alert({
    pluginid: '120000',
    alertRef: '120000-1',
    name: 'Information in Browser localStorage',
    desc: 'Information was stored in browser localStorage.',
    solution: 'Review the stored data.',
    riskcode: '0',
    instances: [
      instance({
        param: 'theme-preference',
        otherinfo: storageEvidence(),
      }),
    ],
    ...overrides,
  });
}

function cacheBusterAlert(overrides = {}) {
  return alert({
    pluginid: '10024',
    alertRef: '10024',
    name: 'Information Disclosure - Sensitive Information in URL',
    riskcode: '0',
    instances: [
      instance({
        uri: 'http://localhost:4200/ngsw.json?ngsw-cache-bust=0.4190372100005838',
        param: 'ngsw-cache-bust',
        evidence: '0.4190372100005838',
      }),
    ],
    ...overrides,
  });
}

function httpOnlyAlert(overrides = {}) {
  return alert({
    pluginid: '10106',
    alertRef: '10106',
    name: 'HTTP Only Site',
    riskcode: '2',
    instances: [instance({ uri: 'http://localhost:4200/' })],
    ...overrides,
  });
}

function convert(t, alerts, rules) {
  const directory = mkdtempSync(join(tmpdir(), 'zap-sarif-test-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const reportPath = join(directory, 'report.json');
  const outputPath = join(directory, 'results.sarif');
  writeFileSync(reportPath, JSON.stringify({ '@version': 'test', site: [{ alerts }] }));
  const args = ['--no-warnings', '--experimental-strip-types', converter, reportPath, outputPath];
  if (rules !== undefined) {
    const rulesPath = join(directory, 'rules.tsv');
    writeFileSync(rulesPath, rules);
    args.push(rulesPath);
  }
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(readFileSync(outputPath, 'utf8')).runs[0];
}

test('CSP subrules retain distinct identities, descriptions, and findings', (t) => {
  const alerts = [
    alert(),
    alert({
      alertRef: '10055-6',
      name: 'CSP: style-src unsafe-inline',
      desc: 'The style policy permits inline styles.',
    }),
    alert({
      alertRef: '10055-13',
      name: 'CSP: Failure to Define Directive with No Fallback',
      desc: 'A required policy directive has no fallback.',
    }),
  ];
  const run = convert(t, alerts);
  assert.deepEqual(
    run.results.map((result) => result.ruleId),
    ['ZAP-10055-4', 'ZAP-10055-6', 'ZAP-10055-13'],
  );
  for (const [index, rule] of run.tool.driver.rules.entries()) {
    assert.equal(rule.name, alerts[index].name);
    assert.equal(rule.fullDescription.text, alerts[index].desc);
    assert.equal(rule.helpUri, `https://www.zaproxy.org/docs/alerts/${alerts[index].alertRef}/`);
    assert.equal(run.results[index].level, 'warning');
  }
});

test('only informational Modern Web Application observations are omitted', (t) => {
  const modern = { pluginid: '10109', alertRef: '10109', name: 'Modern Web Application' };
  const run = convert(t, [
    alert({ ...modern, riskcode: 0 }),
    alert({ ...modern, riskcode: '0' }),
    alert({ ...modern, riskcode: '1' }),
    alert({ ...modern, alertRef: '10109-2', riskcode: '0' }),
    alert({ pluginid: '99999', alertRef: '99999', riskcode: '0' }),
  ]);
  assert.deepEqual(
    run.results.map(({ ruleId, level }) => ({ ruleId, level })),
    [
      { ruleId: 'ZAP-10109', level: 'note' },
      { ruleId: 'ZAP-10109-2', level: 'none' },
      { ruleId: 'ZAP-99999', level: 'none' },
    ],
  );
});

test('all three reviewed theme values are omitted with complete instance evidence', (t) => {
  const alerts = ['auto', 'light', 'dark'].flatMap((value) =>
    [0, '0'].map((riskcode) =>
      storageAlert({
        riskcode,
        instances: [
          instance({
            param: 'theme-preference',
            otherinfo: storageEvidence(value),
          }),
        ],
      }),
    ),
  );
  const run = convert(t, alerts);
  assert.deepEqual(run.results, []);
  assert.deepEqual(run.tool.driver.rules, []);
});

test('storage findings with unknown keys, values, metadata, or severity remain visible', (t) => {
  const findings = [
    storageAlert({ riskcode: '1' }),
    storageAlert({ riskcode: 'unknown' }),
    storageAlert({ riskcode: '' }),
    storageAlert({ alertRef: '120000-2' }),
    storageAlert({ alertRef: undefined }),
    storageAlert({
      instances: [instance({ param: 'theme-preference' })],
    }),
    storageAlert({
      instances: [instance({ otherinfo: storageEvidence() })],
    }),
    ...[
      ['access-token', 'example-token'],
      ['theme-preference', 'custom'],
      ['theme-preference', 'auto-extra'],
      ['theme-preference', 'auto\nUnexpected data: example-token'],
    ].map(([param, value]) =>
      storageAlert({
        instances: [instance({ param, otherinfo: storageEvidence(value, param) })],
      }),
    ),
  ];
  const run = convert(t, findings);
  assert.equal(run.results.length, findings.length);
  assert.equal(run.results[0].level, 'note');
  assert.equal(run.results[1].level, 'warning');
  assert.equal(run.results[2].level, 'warning');
});

test('a reviewed theme instance does not hide other storage findings or expose values', (t) => {
  const reviewed = storageAlert().instances[0];
  const run = convert(t, [
    storageAlert({
      instances: [
        reviewed,
        instance({
          param: 'access-token',
          evidence: 'DO_NOT_EXPORT_EVIDENCE',
          otherinfo: 'DO_NOT_EXPORT_STORAGE_VALUE',
        }),
      ],
    }),
  ]);
  assert.equal(run.results.length, 1);
  assert.equal(run.results[0].ruleId, 'ZAP-120000-1');
  assert.match(run.results[0].message.text, /Information in Browser localStorage/);
  assert.match(run.results[0].message.text, /Method: GET/);
  assert.match(run.results[0].message.text, /Parameter: access-token/);
  assert.equal(run.results[0].locations[0].physicalLocation.artifactLocation.uri, 'index.html');
  assert.doesNotMatch(JSON.stringify(run), /DO_NOT_EXPORT/);
});

test('missing alert references retain legacy IDs and configured exclusions stay precise', (t) => {
  const run = convert(
    t,
    [
      alert(),
      alert({ alertRef: '10055-6' }),
      alert({ pluginid: '10020', alertRef: undefined }),
      alert({ pluginid: '10098', alertRef: undefined, riskcode: 3 }),
    ],
    '# Reviewed scanner rules\n10055-4\tIGNORE\tExact subrule\n10020\tIGNORE\tWhole plugin\n',
  );
  assert.deepEqual(
    run.results.map(({ ruleId, level }) => ({ ruleId, level })),
    [
      { ruleId: 'ZAP-10055-6', level: 'warning' },
      { ruleId: 'ZAP-10098', level: 'error' },
    ],
  );
});

test('only the exact informational Angular decimal cache-buster observation is omitted', (t) => {
  const run = convert(t, [cacheBusterAlert(), cacheBusterAlert({ riskcode: 0 })]);
  assert.deepEqual(run.results, []);
  assert.deepEqual(run.tool.driver.rules, []);
});

test('URL disclosure findings retain unknown values, queries, paths, and severities', (t) => {
  const knownInstance = cacheBusterAlert().instances[0];
  const modifiedInstances = [
    { param: 'credit-card' },
    { evidence: undefined },
    { evidence: '0.25' },
    { uri: 'http://localhost:4200/report?ngsw-cache-bust=0.4190372100005838' },
    { uri: `${knownInstance.uri}&account=example-account` },
    { uri: `${knownInstance.uri}&ngsw-cache-bust=0.4190372100005838` },
    { uri: `${knownInstance.uri}#example-fragment` },
    { uri: 'invalid URL' },
    ...['0', '0.0', '1', '1.0', '0.99999999999999999', '-0.5', 'Infinity', 'NaN'].map(
      (evidence) => ({
        evidence,
        uri: `http://localhost:4200/ngsw.json?ngsw-cache-bust=${evidence}`,
      }),
    ),
  ];
  const findings = [
    cacheBusterAlert({ riskcode: '1' }),
    cacheBusterAlert({ riskcode: '' }),
    cacheBusterAlert({ pluginid: '10025' }),
    cacheBusterAlert({ alertRef: '10024-1' }),
    cacheBusterAlert({ alertRef: undefined }),
    ...modifiedInstances.map((overrides) =>
      cacheBusterAlert({ instances: [{ ...knownInstance, ...overrides }] }),
    ),
  ];
  const run = convert(t, findings);
  assert.equal(run.results.length, findings.length);
});

test('the exact HTTP-only loopback harness finding is omitted', (t) => {
  const run = convert(t, [httpOnlyAlert(), httpOnlyAlert({ riskcode: 2 })]);
  assert.deepEqual(run.results, []);
  assert.deepEqual(run.tool.driver.rules, []);
});

test('HTTP-only findings remain visible for production, other targets, and severities', (t) => {
  const findings = [
    httpOnlyAlert({ riskcode: '1' }),
    httpOnlyAlert({ riskcode: 3 }),
    httpOnlyAlert({ alertRef: undefined }),
    httpOnlyAlert({ alertRef: '10106-1' }),
    httpOnlyAlert({ pluginid: '10107' }),
    ...[
      'http://tools.pylot.dev/',
      'https://tools.pylot.dev/',
      'http://localhost:4200/report',
      'http://localhost:4200/?target=example',
      'http://localhost:4200/#/',
      'http://localhost:4201/',
      'http://127.0.0.1:4200/',
      'http://localhost:4200.example.com/',
      'https://localhost:4200/',
    ].map((uri) => httpOnlyAlert({ instances: [instance({ uri })] })),
  ];
  const run = convert(t, findings);
  assert.equal(run.results.length, findings.length);
});
