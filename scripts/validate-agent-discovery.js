const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const MEDIA_TYPE_PATTERN =
  /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;\s*[a-z0-9!#$&^_.+-]+=(?:"[^"\r\n]*"|[a-z0-9!#$&^_.:+-]+))*$/i;

const outputRoot = process.argv[2] ?? 'public';
const wellKnownRoot = join(outputRoot, '.well-known');
const aiCatalog = readJson(join(wellKnownRoot, 'ai-catalog.json'));
const ardManifest = readJson(join(wellKnownRoot, 'ard.json'));
const serverCard = readJson(join(wellKnownRoot, 'mcp', 'server-card.json'));

validateCatalog(aiCatalog);
validateCatalog(ardManifest);
assert.deepEqual(ardManifest, aiCatalog, 'ARD aliases must publish the same entries.');
validateServerCard(serverCard);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function validateCatalog(catalog) {
  assert.equal(catalog.specVersion, '1.0');
  assert.ok(catalog.host?.displayName);
  assert.equal(new URL(catalog.host.identifier).protocol, 'https:');
  assert.ok(Array.isArray(catalog.entries) && catalog.entries.length > 0);

  const identifiers = new Set();

  for (const entry of catalog.entries) {
    assert.match(entry.identifier, /^urn:air:tools\.pylot\.dev(?::[a-zA-Z0-9._-]+){2,}$/);
    assert.ok(!identifiers.has(entry.identifier), `Duplicate ARD identifier: ${entry.identifier}`);
    identifiers.add(entry.identifier);

    assert.ok(entry.displayName);
    assert.match(entry.type, MEDIA_TYPE_PATTERN);

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
        entry.representativeQueries.length <= 5,
      `${entry.identifier} must have 2-5 representative queries.`,
    );
    assert.ok(entry.representativeQueries.every((query) => query.trim().length > 0));
  }
}

function validateServerCard(card) {
  assert.ok(card.serverInfo?.name);
  assert.ok(card.serverInfo?.version);
  assert.equal(new URL(card.endpoint).protocol, 'https:');

  for (const capability of ['tools', 'resources', 'prompts']) {
    assert.equal(typeof card.capabilities?.[capability], 'boolean');
  }
}
