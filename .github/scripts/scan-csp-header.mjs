#!/usr/bin/env node

import { text } from 'node:stream/consumers';
import { createHtmlContentSecurityPolicy } from '../../worker/link-headers.mjs';

if (process.argv.length !== 2) {
  throw new Error('Pipe the production HTML to standard input; no arguments are accepted.');
}

// This is trusted build output; only its CSP hashes are emitted, never its HTML bytes.
const html = await text(process.stdin);
const policy = createHtmlContentSecurityPolicy(html);
if (!policy) throw new Error('The production HTML has no Angular autoCsp script hashes.');
if (!/style-src 'self' 'sha256-/.test(policy) || policy.includes("'unsafe-inline'")) {
  throw new Error('The production HTML has no strict style hash policy. Run npm run build.');
}
process.stdout.write(policy);
