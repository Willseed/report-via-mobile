#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const RETRY_COUNT = 6;
const RETRY_DELAY_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const BUILD_DIRECTORY = resolve(
  fileURLToPath(new URL('../dist/report-via-mobile/browser/', import.meta.url)),
);
const BUILD_MANIFEST_PATH = resolve(BUILD_DIRECTORY, 'ngsw.json');
const SAFE_ASSET_PATH = /^\/[A-Za-z0-9._/-]+$/;
const REQUIRED_HASHED_DOCUMENTS = new Set([
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-authorization-server',
]);

function parseManifest(manifestBytes) {
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert.ok(
    manifest.hashTable &&
      typeof manifest.hashTable === 'object' &&
      !Array.isArray(manifest.hashTable),
    'The PWA manifest has no valid hash table.',
  );
  return manifest;
}

function validateBuildSnapshot(expectedBuild) {
  assert.ok(Buffer.isBuffer(expectedBuild.manifestBytes), 'The local PWA manifest is missing.');
  assert.ok(expectedBuild.assets instanceof Map, 'The local PWA assets are missing.');
  const manifest = parseManifest(expectedBuild.manifestBytes);

  for (const [path, expectedHash] of Object.entries(manifest.hashTable)) {
    const bytes = expectedBuild.assets.get(path);
    assert.ok(Buffer.isBuffer(bytes), `${path} is absent from the local build.`);
    assert.match(expectedHash, /^[a-f0-9]{40}$/, `${path} has an invalid PWA manifest hash.`);
    // Angular ngsw.json specifies SHA-1 as an asset checksum, not as a password hash or signature.
    const actualHash = createHash('sha1').update(bytes).digest('hex'); // NOSONAR
    assert.equal(actualHash, expectedHash, `${path} differs from its PWA manifest hash.`);
  }

  return manifest;
}

function buildAssetPath(path) {
  assert.match(path, SAFE_ASSET_PATH, `Invalid PWA asset path: ${path}`);
  const segments = path.slice(1).split('/');
  assert.ok(
    segments.every((segment) => segment && segment !== '.' && segment !== '..'),
    `Invalid PWA asset path: ${path}`,
  );
  const filePath = resolve(BUILD_DIRECTORY, ...segments);
  assert.ok(filePath.startsWith(`${BUILD_DIRECTORY}${sep}`), `Asset escapes build directory: ${path}`);
  return filePath;
}

export async function loadBuildSnapshot() {
  // The build root and manifest filename are fixed relative to this script.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const manifestBytes = await readFile(BUILD_MANIFEST_PATH);
  const manifest = parseManifest(manifestBytes);
  const assets = new Map();

  for (const path of Object.keys(manifest.hashTable)) {
    // buildAssetPath rejects traversal and confines each entry to the fixed build directory.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    assets.set(path, await readFile(buildAssetPath(path)));
  }

  const snapshot = { manifestBytes, assets };
  validateBuildSnapshot(snapshot);
  return snapshot;
}

async function readResponse(baseUrl, path, fetchImpl, headers = {}) {
  const url = new URL(path, baseUrl);
  const response = await fetchImpl(url, {
    headers,
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  assert.equal(response.status, 200, `${url.pathname} returned HTTP ${response.status}`);
  return { response, bytes: Buffer.from(await response.arrayBuffer()) };
}

function assertHardenedCsp(response, label) {
  const csp = response.headers.get('content-security-policy') ?? '';
  assert.ok(csp, `${label} lacks a Content-Security-Policy header.`);
  assert.match(csp, /frame-ancestors\s+'none'/i);
  const directives = csp.split(';').map((directive) => directive.trim());
  const scriptSource = directives.find((directive) => /^script-src\s+/i.test(directive));
  assert.ok(scriptSource, `${label} lacks a script-src policy.`);
  assert.match(scriptSource, /'sha256-[A-Za-z0-9+/=]+'/);
  assert.doesNotMatch(scriptSource, /'unsafe-inline'/);
  assert.doesNotMatch(scriptSource, /'strict-dynamic'/);
  const scriptDirectives = directives.filter((entry) => /^script-src(?:-elem|-attr)?\s+/i.test(entry));
  for (const directive of scriptDirectives) {
    assert.doesNotMatch(directive, /'unsafe-inline'/);
  }
  assert.ok(
    directives.some((directive) => /^script-src-attr\s+'none'$/i.test(directive)),
    `${label} must block inline script attributes.`,
  );
}

export async function verifyEdgeOnce(baseUrl, expectedBuild, fetchImpl = fetch) {
  const siteUrl = new URL(baseUrl);
  assert.equal(siteUrl.protocol, 'https:', 'Edge verification requires an HTTPS origin.');
  const origin = new URL('/', siteUrl);
  const manifest = validateBuildSnapshot(expectedBuild);
  const expectedHomepage = expectedBuild.assets.get('/index.html');
  assert.ok(Buffer.isBuffer(expectedHomepage), 'The local build has no index.html asset.');

  const { response: page, bytes: pageBytes } = await readResponse(origin, '/', fetchImpl);
  assert.match(page.headers.get('content-type') ?? '', /text\/html/i);
  assert.ok(pageBytes.equals(expectedHomepage), 'Homepage HTML differs from the local build.');

  for (const header of [
    'content-security-policy',
    'strict-transport-security',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
  ]) {
    assert.ok(page.headers.get(header), `Homepage lacks ${header}.`);
  }
  assertHardenedCsp(page, 'Homepage');
  assert.equal(page.headers.get('x-frame-options')?.toUpperCase(), 'DENY');
  assert.equal(page.headers.get('x-content-type-options')?.toLowerCase(), 'nosniff');

  const { response: fallback, bytes: fallbackBytes } = await readResponse(
    origin,
    '/404.html',
    fetchImpl,
  );
  assert.match(fallback.headers.get('content-type') ?? '', /text\/html/i);
  assert.deepEqual(fallbackBytes, pageBytes, '404.html differs from the deployed homepage.');
  assertHardenedCsp(fallback, '404.html');

  const { response: markdown, bytes: markdownBytes } = await readResponse(origin, '/', fetchImpl, {
    Accept: 'text/markdown',
  });
  assert.match(markdown.headers.get('content-type') ?? '', /text\/markdown/i);
  assert.match(markdownBytes.toString('utf8'), /^# /);

  const { response: auth } = await readResponse(origin, '/auth.md', fetchImpl);
  assert.match(auth.headers.get('content-type') ?? '', /text\/markdown/i);

  const { bytes: manifestBytes } = await readResponse(origin, '/ngsw.json', fetchImpl);
  assert.ok(manifestBytes.equals(expectedBuild.manifestBytes), 'Edge still serves a different build.');
  if (manifest.dataGroups !== undefined) {
    assert.ok(Array.isArray(manifest.dataGroups), 'The PWA data groups are invalid.');
    for (const group of manifest.dataGroups) {
      assert.notEqual(
        group?.name,
        'nominatim-api',
        'The Service Worker still persistently caches Nominatim requests.',
      );
    }
  }

  for (const path of REQUIRED_HASHED_DOCUMENTS) {
    assert.ok(Object.hasOwn(manifest.hashTable, path), `${path} is absent from the PWA hash table.`);
  }

  for (const path of Object.keys(manifest.hashTable)) {
    const expectedBytes = expectedBuild.assets.get(path);
    assert.ok(Buffer.isBuffer(expectedBytes), `${path} is absent from the local build.`);
    const { response, bytes } = await readResponse(origin, path, fetchImpl);
    assert.ok(bytes.equals(expectedBytes), `${path} differs from the local PWA asset.`);
    if (REQUIRED_HASHED_DOCUMENTS.has(path)) {
      assert.equal(response.headers.get('x-agent-ready-worker'), 'active');
      assert.match(response.headers.get('content-type') ?? '', /application\/json/i);
    }
  }

  return Object.keys(manifest.hashTable).length;
}

export async function verifyEdgeDeployment(
  baseUrl,
  expectedBuild,
  fetchImpl = fetch,
  sleep = delay,
) {
  validateBuildSnapshot(expectedBuild);
  let lastError;
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      return await verifyEdgeOnce(baseUrl, expectedBuild, fetchImpl);
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

async function runCli() {
  const baseUrl = process.argv[2];
  if (!baseUrl || process.argv.length !== 3) {
    throw new Error('Pass only the deployed HTTPS site URL.');
  }
  const expectedBuild = await loadBuildSnapshot();
  const verifiedCount = await verifyEdgeDeployment(baseUrl, expectedBuild);
  console.info(`Verified Edge headers, documents, and ${verifiedCount} PWA assets.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await runCli();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
