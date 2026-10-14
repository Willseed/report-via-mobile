#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { collectBuiltStyleHashes } from './collect-style-hashes.mjs';

const AUTO_CSP_META_PATTERN = /(<meta\b[^>]*\bhttp-equiv="Content-Security-Policy"[^>]*\bcontent=")([^"]+)(")/i;
const HASH_PATTERN = /^'sha256-[A-Za-z0-9+/]{43}='$/;

function styleHash(css) {
  return `'sha256-${createHash('sha256').update(css).digest('base64')}'`;
}

function compareHashes(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

// Process trusted build HTML before publishing it or finalizing its PWA checksum.
// Keep the existing bytes/formatting everywhere except the two CSP metadata values.
export function hardenHtmlStyles(html, componentHashes) {
  assert.ok(AUTO_CSP_META_PATTERN.test(html), 'Angular autoCsp metadata is required.');
  assert.ok(!html.includes('name="csp-style-hashes"'), 'Style CSP was already generated.');
  assert.ok(componentHashes.length > 0 && componentHashes.every((hash) => HASH_PATTERN.test(hash)),
    'The component style inventory is missing or invalid.');

  const dom = new JSDOM(html);
  try {
    assert.equal(dom.window.document.querySelectorAll('[style]').length, 0,
      'Move HTML style attributes to stylesheets before generating strict CSP.');
    const inlineHashes = [...dom.window.document.querySelectorAll('style')]
      .map((element) => styleHash(element.textContent));
    const hashes = [...new Set([...componentHashes, ...inlineHashes])].sort(compareHashes);
    const stylePolicy = `style-src 'self' ${hashes.join(' ')}; style-src-attr 'none'`;
    // The meta policy travels with the HTML in the offline cache and protects
    // direct static hosting too; the Worker mirrors it in the response header.
    return html.replace(AUTO_CSP_META_PATTERN, (_, prefix, policy, suffix) => {
      const directives = policy.split(';').map((value) => value.trim())
        .filter((value) => value && !/^style-src(?:-elem|-attr)?(?:\s|$)/i.test(value));
      return `${prefix}${directives.join('; ')}; ${stylePolicy}${suffix}`;
    }).replace(/<head\b[^>]*>/i, (headHtml) =>
      `${headHtml}<meta name="csp-style-hashes" content="${hashes.join(' ')}">`);
  } finally {
    dom.window.close();
  }
}

async function finalizeBuild() {
  // The build wrapper selects the output directory as cwd; no filesystem paths
  // are accepted from script arguments or from HTML metadata.
  const html = await readFile('index.html', 'utf8');
  let manifest;
  try {
    manifest = JSON.parse(await readFile('ngsw.json', 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (!AUTO_CSP_META_PATTERN.test(html)) {
    assert.ok(!manifest, 'A PWA production build must enable Angular autoCsp.');
    console.info('Skipping strict style CSP for a development build.');
    return;
  }

  const { hashes } = await collectBuiltStyleHashes(process.cwd());
  const hardenedHtml = hardenHtmlStyles(html, hashes);
  await writeFile('index.html', hardenedHtml);
  if (manifest) {
    assert.ok(Object.hasOwn(manifest.hashTable, '/index.html'),
      'The PWA manifest must continue to hash index.html.');
    // Angular uses SHA-1 as a content checksum, not an authentication primitive.
    manifest.hashTable['/index.html'] = createHash('sha1').update(hardenedHtml).digest('hex'); // NOSONAR
    await writeFile('ngsw.json', `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.info(`Generated strict style CSP from ${hashes.length} component style hashes.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await finalizeBuild();
