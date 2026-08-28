const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');

const TOKEN_CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$&^_.+-';
const IDENTIFIER_SEGMENT_CHARACTERS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-';
const IDENTIFIER_PREFIX = 'urn:air:tools.pylot.dev:';

switch (process.argv[2] ?? 'public') {
  case 'public':
    process.chdir('public');
    break;
  case 'dist/report-via-mobile/browser':
    process.chdir('dist/report-via-mobile/browser');
    break;
  default:
    throw new Error('Output root must be public or dist/report-via-mobile/browser.');
}

const aiCatalog = JSON.parse(readFileSync('.well-known/ai-catalog.json', 'utf8'));
const ardManifest = JSON.parse(readFileSync('.well-known/ard.json', 'utf8'));
const serverCard = JSON.parse(readFileSync('.well-known/mcp/server-card.json', 'utf8'));
const skillsIndex = JSON.parse(readFileSync('.well-known/agent-skills/index.json', 'utf8'));
const expectedWebMcpTools = [
  'list_violation_types',
  'lookup_station',
  'set_report_form',
  'preview_sms',
  'open_sms_composer',
];

validateCatalog(aiCatalog);
validateCatalog(ardManifest);
assert.deepEqual(ardManifest, aiCatalog, 'ARD aliases must publish the same entries.');
validateServerCard(serverCard);
assert.equal(skillsIndex.skills?.[0]?.name, 'report-via-mobile');
assert.deepEqual(
  aiCatalog.entries.find((entry) => entry.identifier.endsWith(':skill:report-via-mobile'))?.capabilities,
  expectedWebMcpTools,
);
assert.deepEqual(
  ardManifest.entries.find((entry) => entry.identifier.endsWith(':skill:report-via-mobile'))?.capabilities,
  expectedWebMcpTools,
);

function validateCatalog(catalog) {
  assert.equal(catalog.specVersion, '1.0');
  assert.ok(catalog.host?.displayName);
  assert.equal(new URL(catalog.host.identifier).protocol, 'https:');
  assert.ok(Array.isArray(catalog.entries) && catalog.entries.length > 0);

  const identifiers = new Set();

  for (const entry of catalog.entries) {
    assert.ok(
      isValidIdentifier(entry.identifier),
      `Invalid ARD identifier: ${String(entry.identifier)}`,
    );
    assert.ok(!identifiers.has(entry.identifier), `Duplicate ARD identifier: ${entry.identifier}`);
    identifiers.add(entry.identifier);

    assert.ok(entry.displayName);
    assert.ok(isValidMediaType(entry.type), `Invalid media type: ${String(entry.type)}`);

    const hasUrl = Object.hasOwn(entry, 'url');
    const hasData = Object.hasOwn(entry, 'data');
    assert.notEqual(hasUrl, hasData, `${entry.identifier} must have exactly one of url or data.`);

    if (hasUrl) {
      assert.equal(new URL(entry.url).protocol, 'https:');
    } else {
      assert.equal(typeof entry.data, 'object');
      assert.notEqual(entry.data, null);
    }

    assert.ok(
      Array.isArray(entry.representativeQueries) &&
        entry.representativeQueries.length >= 2 &&
        entry.representativeQueries.length <= 5 &&
        entry.representativeQueries.every(
          (query) => typeof query === 'string' && query.trim().length > 0,
        ),
      `${entry.identifier} must have 2-5 non-empty representative queries.`,
    );
  }
}

function validateServerCard(card) {
  assert.ok(card.serverInfo?.name);
  assert.ok(card.serverInfo?.version);
  assert.equal(new URL(card.endpoint).protocol, 'https:');
  assert.equal(typeof card.capabilities?.tools, 'boolean');
  assert.equal(typeof card.capabilities?.resources, 'boolean');
  assert.equal(typeof card.capabilities?.prompts, 'boolean');
  assert.equal(card.transport, null);
  assert.equal(card.capabilities.tools, false);
}

function isValidIdentifier(value) {
  if (typeof value !== 'string' || !value.startsWith(IDENTIFIER_PREFIX)) {
    return false;
  }

  const segments = value.slice(IDENTIFIER_PREFIX.length).split(':');
  return (
    segments.length >= 2 &&
    segments.every((segment) => hasOnlyCharacters(segment, IDENTIFIER_SEGMENT_CHARACTERS))
  );
}

function isValidMediaType(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const [mediaRange, ...parameters] = value.split(';');
  const [type, subtype, ...extraParts] = mediaRange.trim().split('/');

  return (
    extraParts.length === 0 &&
    isToken(type) &&
    isToken(subtype) &&
    parameters.every(isValidMediaParameter)
  );
}

function isValidMediaParameter(parameter) {
  const separator = parameter.indexOf('=');
  const name = parameter.slice(0, separator).trim();
  const value = parameter.slice(separator + 1).trim();

  return separator > 0 && isToken(name) && (isToken(value) || isQuotedString(value));
}

function isQuotedString(value) {
  return (
    value.length >= 2 &&
    value.startsWith('"') &&
    value.endsWith('"') &&
    !value.slice(1, -1).includes('"') &&
    !value.includes('\r') &&
    !value.includes('\n')
  );
}

function isToken(value) {
  return typeof value === 'string' && hasOnlyCharacters(value, TOKEN_CHARACTERS);
}

function hasOnlyCharacters(value, allowedCharacters) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    [...value].every((character) => allowedCharacters.includes(character))
  );
}
