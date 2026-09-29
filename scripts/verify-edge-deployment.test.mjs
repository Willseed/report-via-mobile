import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyEdgeOnce } from './verify-edge-deployment.mjs';

function fixture({
  changedDocument = false,
  changedScript = false,
  persistentLocationCache = false,
  weakCsp = false,
  weakFallbackCsp = false,
  strictDynamic = false,
} = {}) {
  // These tests compare response bytes and headers; HTML markup is not part of the fixture behavior.
  const homepageBytes = Buffer.from('fixture page');
  const protectedResource = '{"resource":"https://tools.pylot.dev/"}\n';
  const authorizationServer = '{"issuer":"https://tools.pylot.dev/"}\n';
  const script = 'window.appReady=true;';
  const manifest = Buffer.from(
    JSON.stringify({
      hashTable: {
        '/index.html': '7128efb056b985603356506cddbef5bc75678785',
        '/.well-known/oauth-protected-resource': '74afa088bf9135d944a154d4556f6f10a2199e57',
        '/.well-known/oauth-authorization-server': '701dbb20c82ee441f3bebec0ebf325ab03c4cb30',
        '/main-TEST.js': 'f22d31b39c9752ce80133f7b8a91213aeb6b985e',
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
  const build = {
    manifestBytes: manifest,
    assets: new Map([
      ['/index.html', homepageBytes],
      ['/.well-known/oauth-protected-resource', Buffer.from(protectedResource)],
      ['/.well-known/oauth-authorization-server', Buffer.from(authorizationServer)],
      ['/main-TEST.js', Buffer.from(script)],
    ]),
  };
  const responses = new Map([
    ['/', new Response(homepageBytes, { headers: securityHeaders })],
    ['/index.html', new Response(homepageBytes, { headers: securityHeaders })],
    [
      '/404.html',
      new Response(homepageBytes, {
        headers: {
          ...securityHeaders,
          ...(weakFallbackCsp
            ? {
                'Content-Security-Policy':
                  "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
              }
            : {}),
        },
      }),
    ],
    ['/auth.md', new Response('# Auth\n', { headers: { 'Content-Type': 'text/markdown' } })],
    ['/ngsw.json', new Response(manifest)],
    [
      '/.well-known/oauth-protected-resource',
      new Response(changedDocument ? `${protectedResource}changed` : protectedResource, {
        headers: documentHeaders,
      }),
    ],
    [
      '/.well-known/oauth-authorization-server',
      new Response(authorizationServer, { headers: documentHeaders }),
    ],
    ['/main-TEST.js', new Response(changedScript ? `${script}changed` : script)],
  ]);
  const markdownResponse = new Response('# Site\n', {
    headers: { 'Content-Type': 'text/markdown' },
  });
  const fetchImpl = async (url, options) => {
    if (url.pathname === '/' && options.headers.Accept === 'text/markdown') {
      return markdownResponse.clone();
    }
    const response = responses.get(url.pathname);
    if (!response) throw new Error(`Unexpected path: ${url.pathname}`);
    return response.clone();
  };
  return { fetchImpl, build };
}

test('checks Edge bytes against the same release manifest', async () => {
  const { fetchImpl, build } = fixture();
  assert.equal(await verifyEdgeOnce('https://tools.pylot.dev/', build, fetchImpl), 4);
});

test('rejects a Worker document whose bytes differ from the local build', async () => {
  const { fetchImpl, build } = fixture({ changedDocument: true });
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', build, fetchImpl),
    /oauth-protected-resource differs/,
  );
});

test('rejects a JavaScript asset whose bytes differ from the local build', async () => {
  const { fetchImpl, build } = fixture({ changedScript: true });
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', build, fetchImpl),
    /main-TEST.js differs/,
  );
});

test('rejects a stale manifest hash even when Edge serves the same local asset bytes', async () => {
  const { fetchImpl, build } = fixture({ changedScript: true });
  build.assets.set('/main-TEST.js', Buffer.from('window.appReady=true;changed'));
  let fetchCalls = 0;
  const trackedFetch = (...args) => {
    fetchCalls += 1;
    return fetchImpl(...args);
  };

  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', build, trackedFetch),
    /main-TEST\.js differs from its PWA manifest hash/,
  );
  assert.equal(fetchCalls, 0);
});

test('rejects a previous release and a persistent location data group', async () => {
  const { fetchImpl, build } = fixture({ persistentLocationCache: true });
  const previousManifest = Buffer.from(
    JSON.stringify({ ...JSON.parse(build.manifestBytes.toString('utf8')), timestamp: 1 }),
  );
  await assert.rejects(
    verifyEdgeOnce(
      'https://tools.pylot.dev/',
      { ...build, manifestBytes: previousManifest },
      fetchImpl,
    ),
    /different build/,
  );
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', build, fetchImpl),
    /persistently caches Nominatim/,
  );
});

test('rejects a homepage with inline scripts allowed by its CSP header', async () => {
  const { fetchImpl, build } = fixture({ weakCsp: true });
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', build, fetchImpl),
    /script-src/,
  );
});

test('rejects a 404 page with inline scripts allowed by its CSP header', async () => {
  const { fetchImpl, build } = fixture({ weakFallbackCsp: true });
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', build, fetchImpl),
    /unsafe-inline/,
  );
});

test('rejects a script policy that trusts arbitrary descendants', async () => {
  const { fetchImpl, build } = fixture({ strictDynamic: true });
  await assert.rejects(
    verifyEdgeOnce('https://tools.pylot.dev/', build, fetchImpl),
    /strict-dynamic/,
  );
});
