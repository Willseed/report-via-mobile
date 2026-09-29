#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const RETRY_COUNT = 6;
const RETRY_DELAY_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const REQUIRED_HASHED_DOCUMENTS = [
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-authorization-server',
];

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

export async function verifyEdgeOnce(baseUrl, fetchImpl = fetch, expectedManifestBytes) {
  const siteUrl = new URL(baseUrl);
  assert.equal(siteUrl.protocol, 'https:', 'Edge verification requires an HTTPS origin.');
  const origin = new URL('/', siteUrl);

  const { response: page, bytes: pageBytes } = await readResponse(origin, '/', fetchImpl);
  const html = pageBytes.toString('utf8');
  assert.match(page.headers.get('content-type') ?? '', /text\/html/i);
  assert.match(html, /<html\b/i);

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
  if (expectedManifestBytes) {
    assert.deepEqual(manifestBytes, expectedManifestBytes, 'Edge still serves a different build.');
  }
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  assert.ok(manifest.hashTable && typeof manifest.hashTable === 'object');
  assert.equal(
    createHash('sha1').update(pageBytes).digest('hex'),
    manifest.hashTable['/index.html'],
    'Homepage HTML differs from the PWA manifest hash.',
  );
  assert.ok(
    !manifest.dataGroups?.some((group) => group.name === 'nominatim-api'),
    'The Service Worker still persistently caches Nominatim requests.',
  );

  for (const path of REQUIRED_HASHED_DOCUMENTS) {
    assert.ok(manifest.hashTable[path], `${path} is absent from the PWA hash table.`);
  }

  for (const [path, expectedHash] of Object.entries(manifest.hashTable)) {
    const { response, bytes } = await readResponse(origin, path, fetchImpl);
    const actualHash = createHash('sha1').update(bytes).digest('hex');
    assert.equal(actualHash, expectedHash, `${path} differs from its PWA manifest hash.`);
    if (REQUIRED_HASHED_DOCUMENTS.includes(path)) {
      assert.equal(response.headers.get('x-agent-ready-worker'), 'active');
      assert.match(response.headers.get('content-type') ?? '', /application\/json/i);
    }
  }

  return Object.keys(manifest.hashTable).length;
}

export async function verifyEdgeDeployment(
  baseUrl,
  fetchImpl = fetch,
  sleep = delay,
  expectedManifestBytes,
) {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt += 1) {
    try {
      return await verifyEdgeOnce(baseUrl, fetchImpl, expectedManifestBytes);
    } catch (error) {
      lastError = error;
      if (attempt < RETRY_COUNT) await sleep(RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const baseUrl = process.argv[2];
  if (!baseUrl) throw new Error('Pass the deployed HTTPS site URL.');
  const expectedManifestBytes = process.argv[3] ? await readFile(process.argv[3]) : undefined;
  const verifiedCount = await verifyEdgeDeployment(baseUrl, fetch, delay, expectedManifestBytes);
  console.info(`Verified Edge headers, documents, and ${verifiedCount} PWA resource hashes.`);
}
