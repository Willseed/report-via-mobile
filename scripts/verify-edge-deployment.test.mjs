import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { verifyEdgeOnce } from './verify-edge-deployment.mjs';

function sha1(value) {
  return createHash('sha1').update(value).digest('hex');
}

function fixture({
  changedDocument = false,
  persistentLocationCache = false,
  weakCsp = false,
  weakFallbackCsp = false,
  strictDynamic = false,
} = {}) {
  const html = '<html><body>test</body></html>';
  const protectedResource = '{"resource":"https://tools.pylot.dev/"}\n';
  const authorizationServer = '{"issuer":"https://tools.pylot.dev/"}\n';
  const manifest = Buffer.from(
    JSON.stringify({
      hashTable: {
        '/index.html': sha1(html),
        '/.well-known/oauth-protected-resource': sha1(protectedResource),
        '/.well-known/oauth-authorization-server': sha1(authorizationServer),
      },
      dataGroups: persistentLocationCache ? [{ name: 'nominatim-api' }] : [],
    }),
  );
  const scriptSource = `${strictDynamic ? "'strict-dynamic' " : ''}'sha256-YWJj' 'self'`;
  const safeCsp = [
    "default-src 'self'",
    `script-src ${scriptSource}`,
    "script-src-attr 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
  const securityHeaders = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': weakCsp
      ? "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'"
      : safeCsp,
    'Strict-Transport-Security': 'max-age=31536000',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(self)',
  };
  const documentHeaders = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Agent-Ready-Worker': 'active',
  };
  const fetchImpl = async (url, options) => {
    switch (url.pathname) {
      case '/':
        return options.headers.Accept === 'text/markdown'
          ? new Response('# Site\n', { headers: { 'Content-Type': 'text/markdown' } })
          : new Response(html, { headers: securityHeaders });
      case '/auth.md':
        return new Response('# Auth\n', { headers: { 'Content-Type': 'text/markdown' } });
      case '/ngsw.json':
        return new Response(manifest);
      case '/index.html':
        return new Response(html, { headers: securityHeaders });
      case '/404.html':
        return new Response(html, {
          headers: {
            ...securityHeaders,
            ...(weakFallbackCsp
              ? {
                  'Content-Security-Policy':
                    "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
                }
              : {}),
          },
        });
      case '/.well-known/oauth-protected-resource':
        return new Response(changedDocument ? `${protectedResource}changed` : protectedResource, {
          headers: documentHeaders,
        });
      case '/.well-known/oauth-authorization-server':
        return new Response(authorizationServer, { headers: documentHeaders });
      default:
        throw new Error(`Unexpected path: ${url.pathname}`);
    }
  };
  return { fetchImpl, manifest };
}

test('checks Edge bytes against the same release manifest', async () => {
  const { fetchImpl, manifest } = fixture();
  assert.equal(await verifyEdgeOnce('https://tools.pylot.dev/', fetchImpl, manifest), 3);
});

test('rejects a Worker document whose bytes differ from the PWA hash', async () => {
  const { fetchImpl, manifest } = fixture({ changedDocument: true });
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', fetchImpl, manifest),
    /oauth-protected-resource differs/,
  );
});

test('rejects a previous release and a persistent location data group', async () => {
  const { fetchImpl, manifest } = fixture({ persistentLocationCache: true });
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', fetchImpl, Buffer.from('previous release')),
    /different build/,
  );
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', fetchImpl, manifest),
    /persistently caches Nominatim/,
  );
});

test('rejects a homepage with inline scripts allowed by its CSP header', async () => {
  const { fetchImpl, manifest } = fixture({ weakCsp: true });
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', fetchImpl, manifest),
    /script-src/,
  );
});

test('rejects a 404 page with inline scripts allowed by its CSP header', async () => {
  const { fetchImpl, manifest } = fixture({ weakFallbackCsp: true });
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', fetchImpl, manifest),
    /unsafe-inline/,
  );
});

test('rejects a script policy that trusts arbitrary descendants', async () => {
  const { fetchImpl, manifest } = fixture({ strictDynamic: true });
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', fetchImpl, manifest),
    /strict-dynamic/,
  );
});
