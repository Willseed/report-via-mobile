import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { hardenHtmlStyles } from './write-style-csp.mjs';
import { createHtmlContentSecurityPolicy } from '../worker/link-headers.mjs';

const html = await readFile('worker/fixtures/style-csp.html', 'utf8');
const emptyHash = "'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='";

test('authorizes exact critical CSS and component styles in both HTTP and offline meta policies', () => {
  const original = new JSDOM(html);
  const hardenedHtml = hardenHtmlStyles(html, [emptyHash, emptyHash]);
  const hardened = new JSDOM(hardenedHtml);
  try {
    const originalCss = original.window.document.querySelector('style').textContent;
    const hash = `'sha256-${createHash('sha256').update(originalCss).digest('base64')}'`;
    const metadata = hardened.window.document.querySelector('meta[name="csp-style-hashes"]');
    assert.equal(metadata.content.split(' ').length, 2);
    assert.ok(metadata.content.includes(hash));
    assert.ok(metadata.content.includes(emptyHash));
    const metaPolicy = hardened.window.document.querySelector('meta[http-equiv]').content;
    const headerPolicy = createHtmlContentSecurityPolicy(hardenedHtml);
    for (const policy of [metaPolicy, headerPolicy]) {
      assert.ok(policy.includes(`style-src 'self' ${metadata.content}`));
      assert.ok(policy.includes("style-src-attr 'none'"));
      assert.doesNotMatch(policy, /'unsafe-inline'/);
    }
    assert.equal(hardened.window.document.querySelector('style').textContent, originalCss);
    assert.equal(hardened.window.document.body.textContent, original.window.document.body.textContent);
    assert.throws(() => hardenHtmlStyles(hardenedHtml, [emptyHash]), /already generated/);
  } finally {
    original.window.close();
    hardened.window.close();
  }
});

test('fails the build when the inventory is empty or contains an untrusted source expression', () => {
  for (const inventory of [[], ["'unsafe-inline'"], ["'sha256-invalid'"]]) {
    assert.throws(() => hardenHtmlStyles(html, inventory), /inventory is missing or invalid/);
  }
});
