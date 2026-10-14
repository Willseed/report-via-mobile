#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { createHtmlContentSecurityPolicy } from '../../worker/link-headers.mjs';

const [htmlPath] = process.argv.slice(2);
if (!htmlPath || process.argv.length !== 3) {
  throw new Error('Pass the production index.html path.');
}

// This is trusted build output; only its CSP hashes are emitted, never its HTML bytes.
const html = await readFile(htmlPath, 'utf8');
const policy = createHtmlContentSecurityPolicy(html);
if (!policy) throw new Error('The production HTML has no Angular autoCsp script hashes.');
process.stdout.write(policy);
