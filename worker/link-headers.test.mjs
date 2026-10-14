import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import worker from './link-headers.mjs';

// npm runs this test from the repository root; these are static, trusted response bodies.
const cspFixtureBytes = readFileSync('worker/fixtures/auto-csp.html');
const fallbackFixtureBytes = readFileSync('worker/fixtures/fallback-csp.html');
const legacyFixtureBytes = readFileSync('worker/fixtures/legacy.html');
const scriptOnlyFixtureBytes = readFileSync('worker/fixtures/script-only-csp.html');

async function assertHtmlBodyUnchanged(response, originResponse) {
  // Compare the two HTTP bodies as bytes without passing HTML text to an assertion.
  const actualBytes = new Uint8Array(await response.arrayBuffer());
  const originBytes = new Uint8Array(await originResponse.arrayBuffer());
  assert.deepEqual(actualBytes, originBytes);
}

test('adds discovery links and Accept vary to the HTML homepage', async (t) => {
  mockFetch(
    t,
    async () =>
      new Response('home', {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }),
  );

  const response = await worker.fetch(
    new Request('https://tools.pylot.dev/', {
      headers: {
        Accept: 'text/html',
      },
    }),
  );
  const linkHeader = response.headers.get('Link') ?? '';

  assert.match(linkHeader, /rel="ai-catalog"/);
  assert.match(linkHeader, /\/\.well-known\/ai-catalog\.json/);
  assert.match(linkHeader, /rel="ard"/);
  assert.match(linkHeader, /\/\.well-known\/ard\.json/);
  assert.match(linkHeader, /rel="api-catalog"/);
  assert.match(linkHeader, /\/\.well-known\/oauth-protected-resource/);
  assert.match(linkHeader, /\/\.well-known\/oauth-authorization-server/);
  assert.match(linkHeader, /\/\.well-known\/agent-skills\/index\.json/);
  assert.match(linkHeader, /\/\.well-known\/mcp\/server-card\.json/);
  assert.match(linkHeader, /\/index\.md/);
  assert.match(linkHeader, /\/llms\.txt/);
  assert.match(linkHeader, /\/auth\.md/);
  assert.equal(response.headers.get('Vary'), 'Accept');
  assert.equal(await response.text(), 'home');
});

test('uses sanitized origin requests for static assets', async (t) => {
  mockFetch(t, async (request) => {
    assert.equal(request.url, 'https://tools.pylot.dev/index.html?ngsw-cache-bust=1');
    assert.equal(request.method, 'GET');
    assert.equal(request.headers.get('Authorization'), null);
    assert.equal(request.headers.get('Cookie'), null);
    assert.equal(request.headers.get('Accept'), 'text/html');

    return new Response('home');
  });

  const response = await worker.fetch(
    new Request('https://tools.pylot.dev/index.html?ngsw-cache-bust=1', {
      headers: {
        Accept: 'text/html',
        Authorization: 'Test not-forwarded',
        Cookie: 'debug=not-forwarded',
      },
    }),
  );

  assert.equal(await response.text(), 'home');
});

for (const [path, contentType, status] of [
  ['/', 'text/html', 200],
  ['/index.html', 'text/html', 200],
  ['/404.html', 'text/html', 200],
  ['/missing-page', 'text/html', 404],
  ['/ngsw-worker.js', 'text/javascript', 200],
]) {
  test(`enforces cross-origin isolation at ${path} without changing bytes or status`, async (t) => {
    const originResponse = new Response(
      contentType === 'text/html' ? cspFixtureBytes : 'self.reportAppReady = true;',
      {
        status,
        headers: {
          'Content-Type': contentType,
          'Cross-Origin-Embedder-Policy': 'unsafe-none',
          'Cross-Origin-Opener-Policy': 'unsafe-none',
        },
      },
    );
    mockFetch(t, async () => originResponse.clone());

    const response = await worker.fetch(new Request(`https://tools.pylot.dev${path}`));

    assert.equal(response.status, status);
    assert.equal(response.headers.get('Cross-Origin-Embedder-Policy'), 'require-corp');
    assert.equal(response.headers.get('Cross-Origin-Opener-Policy'), 'same-origin');
    await assertHtmlBodyUnchanged(response, originResponse);
  });
}

test('replaces unsafe inline script rules with built script hashes and preserves HTML bytes', async (t) => {
  const inlineScript = 'window.reportAppReady = true;';
  const hash = createHash('sha256').update(inlineScript).digest('base64');
  const originalPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
    "style-src 'self' 'unsafe-inline'",
    "style-src-elem * 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "frame-ancestors 'none'",
  ].join('; ');
  const originResponse = new Response(cspFixtureBytes, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': originalPolicy,
      'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    },
  });
  mockFetch(t, async () => originResponse.clone());

  const response = await worker.fetch(new Request('https://tools.pylot.dev/'));
  const policy = response.headers.get('Content-Security-Policy') ?? '';

  await assertHtmlBodyUnchanged(response, originResponse);
  assert.match(policy, /default-src 'none'/);
  assert.doesNotMatch(policy, /default-src 'self'/);
  assert.equal(
    policy.split(';').filter((entry) => entry.trim().startsWith('default-src ')).length,
    1,
  );
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /style-src 'self' 'sha256-/);
  assert.match(policy, /style-src-attr 'none'/);
  assert.doesNotMatch(policy, /style-src-elem/);
  assert.doesNotMatch(policy, /'unsafe-inline'/);
  assert.ok(policy.includes(`script-src 'sha256-${hash}' 'self'`));
  assert.match(policy, /script-src-attr 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /base-uri 'self'/);
  assert.match(policy, /form-action 'self'/);
  assert.doesNotMatch(policy, /script-src [^;]*'unsafe-inline'/);
  assert.equal(
    response.headers.get('Strict-Transport-Security'),
    'max-age=63072000; includeSubDomains',
  );
});

test('supplies a complete HTML policy when the origin has no security headers', async (t) => {
  const originResponse = new Response(cspFixtureBytes, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  mockFetch(t, async () => originResponse.clone());

  const response = await worker.fetch(new Request('https://tools.pylot.dev/'));
  const policy = response.headers.get('Content-Security-Policy') ?? '';

  await assertHtmlBodyUnchanged(response, originResponse);
  assert.match(policy, /default-src 'none'/);
  assert.match(policy, /font-src 'self'/);
  assert.match(policy, /manifest-src 'self'/);
  assert.match(policy, /worker-src 'self'/);
  assert.match(policy, /style-src 'self' 'sha256-/);
  assert.match(policy, /style-src-attr 'none'/);
  assert.match(policy, /img-src 'self' data:/);
  assert.match(policy, /connect-src 'self' https:\/\/nominatim\.openstreetmap\.org/);
  assert.match(policy, /form-action 'self'/);
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /script-src 'sha256-/);
  assert.doesNotMatch(policy, /script-src [^;]*'unsafe-inline'/);
});

for (const [path, status] of [
  ['/404.html', 200],
  ['/missing-page', 404],
]) {
  test(`hardens the HTML fallback at ${path} without changing its status or body`, async (t) => {
    const script = 'window.reportAppReady = true;';
    const hash = createHash('sha256').update(script).digest('base64');
    const originResponse = new Response(fallbackFixtureBytes, {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
        'Strict-Transport-Security': 'max-age=63072000',
        'Access-Control-Allow-Origin': '*',
      },
    });
    mockFetch(t, async () => originResponse.clone());

    const response = await worker.fetch(new Request(`https://tools.pylot.dev${path}`));
    const policy = response.headers.get('Content-Security-Policy') ?? '';

    assert.equal(response.status, status);
    await assertHtmlBodyUnchanged(response, originResponse);
    assert.ok(policy.includes(`script-src 'sha256-${hash}' 'self'`));
    assert.match(policy, /script-src-attr 'none'/);
    assert.doesNotMatch(policy, /script-src [^;]*'unsafe-inline'/);
    assert.equal(response.headers.get('Strict-Transport-Security'), 'max-age=63072000');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  });
}

test('preserves the current policy until HTML with build hashes is deployed', async (t) => {
  const originResponse = new Response(legacyFixtureBytes, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Security-Policy': "script-src 'self' 'unsafe-inline'",
    },
  });
  mockFetch(t, async () => originResponse.clone());

  const response = await worker.fetch(new Request('https://tools.pylot.dev/'));

  assert.equal(
    response.headers.get('Content-Security-Policy'),
    "script-src 'self' 'unsafe-inline'",
  );
  await assertHtmlBodyUnchanged(response, originResponse);
});

test('keeps a previous release usable during the Worker-before-Pages rollout', async (t) => {
  const originResponse = new Response(scriptOnlyFixtureBytes, {
    headers: { 'Content-Type': 'text/html' },
  });
  mockFetch(t, async () => originResponse.clone());
  const response = await worker.fetch(new Request('https://tools.pylot.dev/'));
  const policy = response.headers.get('Content-Security-Policy');
  assert.match(policy, /script-src 'sha256-/);
  assert.match(policy, /style-src 'self' 'unsafe-inline'/);
  await assertHtmlBodyUnchanged(response, originResponse);
});

for (const invalidHashList of ['', 'invalid', "'unsafe-inline'", "'sha256-invalid'"]) {
  test(`rejects an invalid style manifest without enabling a legacy allowance: ${invalidHashList}`, async (t) => {
    const html = cspFixtureBytes.toString('utf8')
      .replace("'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='", invalidHashList);
    const originResponse = new Response(html, { headers: { 'Content-Type': 'text/html' } });
    mockFetch(t, async () => originResponse.clone());
    const response = await worker.fetch(new Request('https://tools.pylot.dev/'));
    const policy = response.headers.get('Content-Security-Policy');
    assert.match(policy, /style-src 'self';/);
    assert.match(policy, /style-src-attr 'none'/);
    assert.doesNotMatch(policy, /'unsafe-inline'/);
  });
}

test('keeps HEAD bodyless and leaves conditional 304 responses untouched', async (t) => {
  mockFetch(
    t,
    async (request) =>
      new Response(null, {
        status: request.method === 'HEAD' ? 200 : 304,
        headers: {
          'Content-Type': 'text/html',
          'Content-Security-Policy': "default-src 'self'; script-src 'unsafe-inline'",
        },
      }),
  );

  const head = await worker.fetch(new Request('https://tools.pylot.dev/', { method: 'HEAD' }));
  const notModified = await worker.fetch(
    new Request('https://tools.pylot.dev/', { headers: { 'If-None-Match': '"test"' } }),
  );

  assert.equal(await head.text(), '');
  assert.equal(
    head.headers.get('Content-Security-Policy'),
    "default-src 'self'; script-src 'unsafe-inline'",
  );
  assert.equal(notModified.status, 304);
  assert.equal(await notModified.text(), '');
  assert.equal(
    notModified.headers.get('Content-Security-Policy'),
    "default-src 'self'; script-src 'unsafe-inline'",
  );
});

test('keeps origin fixed for paths that resemble network URLs', async (t) => {
  mockFetch(t, async (request) => {
    const url = new URL(request.url);

    assert.equal(url.origin, 'https://tools.pylot.dev');
    assert.equal(url.pathname, '//evil.example/index.html');

    return new Response('asset');
  });

  const response = await worker.fetch(
    new Request('https://tools.pylot.dev//evil.example/index.html'),
  );

  assert.equal(await response.text(), 'asset');
});

test('serves the markdown homepage when text markdown is preferred', async (t) => {
  let requestedPath = '';
  mockFetch(t, async (request) => {
    requestedPath = new URL(request.url).pathname;
    assert.equal(request.headers.get('Authorization'), null);
    assert.equal(request.headers.get('Cookie'), null);
    assert.equal(request.headers.get('Accept'), 'text/markdown');

    return new Response('# 簡訊報案工具', {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  });

  const response = await worker.fetch(
    new Request('https://tools.pylot.dev/', {
      headers: {
        Accept: 'text/markdown, text/html;q=0.5',
      },
    }),
  );

  assert.equal(requestedPath, '/index.md');
  assert.equal(response.headers.get('Content-Type'), 'text/markdown; charset=utf-8');
  assert.equal(response.headers.get('Content-Location'), '/index.md');
  assert.match(response.headers.get('Link') ?? '', /rel="canonical"/);
  assert.equal(await response.text(), '# 簡訊報案工具');
});

test('serves the markdown homepage bodyless for HEAD requests', async (t) => {
  mockFetch(t, async (request) => {
    assert.equal(request.method, 'HEAD');

    return new Response(null, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  });

  const response = await worker.fetch(
    new Request('https://tools.pylot.dev/', {
      method: 'HEAD',
      headers: {
        Accept: 'text/markdown, text/html;q=0.5',
      },
    }),
  );

  assert.equal(response.headers.get('Content-Type'), 'text/markdown; charset=utf-8');
  assert.equal(await response.text(), '');
});

[
  ['HTML is preferred over markdown', 'text/html, text/markdown;q=0.5'],
  ['markdown is not explicitly accepted', '*/*'],
  ['markdown has zero quality', 'text/markdown; q = 0, text/html;q=0.2'],
  ['Accept header is too large', `text/markdown, ${'a'.repeat(2050)}`],
].forEach(([scenario, accept]) => {
  test(`keeps HTML homepage when ${scenario}`, async (t) => {
    let requestedPath = '';
    mockFetch(t, async (request) => {
      requestedPath = new URL(request.url).pathname;

      return new Response('home');
    });

    const response = await worker.fetch(
      new Request('https://tools.pylot.dev/', {
        headers: { Accept: accept },
      }),
    );

    assert.equal(requestedPath, '/');
    assert.equal(await response.text(), 'home');
  });
});

test('returns the same markdown body for the homepage negotiation and index.md', async (t) => {
  const markdownBody = '# 台灣交通違規簡訊報案工具\\n';
  mockFetch(t, async () => new Response(markdownBody));

  const directResponse = await worker.fetch(
    new Request('https://tools.pylot.dev/index.md', {
      headers: { Accept: 'text/markdown' },
    }),
  );
  const negotiatedResponse = await worker.fetch(
    new Request('https://tools.pylot.dev/', {
      headers: { Accept: 'text/markdown' },
    }),
  );

  assert.equal(await negotiatedResponse.text(), await directResponse.text());
});

test('adds public CORS headers to agent documents and supports preflight', async (t) => {
  let fetchCalls = 0;
  mockFetch(t, async () => {
    fetchCalls += 1;
    return new Response('document');
  });

  for (const path of [
    '/llms.txt',
    '/index.md',
    '/auth.md',
    '/.well-known/api-catalog',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-authorization-server',
  ]) {
    const response = await worker.fetch(
      new Request(`https://tools.pylot.dev${path}`, {
        headers: { Origin: 'https://example.com' },
      }),
    );

    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, OPTIONS');
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  }

  const optionsResponse = await worker.fetch(
    new Request('https://tools.pylot.dev/llms.txt', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://example.com',
        'Access-Control-Request-Method': 'GET',
      },
    }),
  );

  assert.equal(optionsResponse.status, 204);
  assert.equal(optionsResponse.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(optionsResponse.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, OPTIONS');
  assert.equal(optionsResponse.headers.get('Access-Control-Allow-Credentials'), null);
  assert.equal(fetchCalls, 6);
});

test('supports preflight for any well-known document', async () => {
  const response = await worker.fetch(
    new Request('https://tools.pylot.dev/.well-known/oauth-protected-resource', {
      method: 'OPTIONS',
      headers: { Origin: 'https://example.com' },
    }),
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, OPTIONS');
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
});

test('removes origin CORS headers from the HTML app and non-document assets', async (t) => {
  mockFetch(
    t,
    async () =>
      new Response('asset', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Credentials': 'true',
        },
      }),
  );

  for (const path of ['/', '/main.js']) {
    const response = await worker.fetch(new Request(`https://tools.pylot.dev${path}`));

    assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), null);
    assert.equal(response.headers.get('Access-Control-Allow-Headers'), null);
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  }
});

test('sets content type for static well-known metadata', async (t) => {
  mockFetch(
    t,
    async () =>
      new Response('{}', {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }),
  );

  const response = await worker.fetch(
    new Request('https://tools.pylot.dev/.well-known/api-catalog'),
  );

  assert.equal(response.headers.get('Content-Type'), 'application/linkset+json; charset=utf-8');
});

test('serves ARD manifests from the edge with public CORS', async (t) => {
  let fetchCalls = 0;
  mockFetch(t, async () => {
    fetchCalls += 1;
    return new Response('unexpected');
  });

  for (const path of ['/.well-known/ai-catalog.json', '/.well-known/ard.json']) {
    const response = await worker.fetch(new Request(`https://tools.pylot.dev${path}`));
    const manifest = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, OPTIONS');
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=3600');
    assert.equal(response.headers.get('X-Agent-Ready-Worker'), 'active');
    assert.equal(manifest.specVersion, '1.0');
    assert.equal(manifest.host.identifier, 'https://tools.pylot.dev/');
    assert.ok(manifest.entries.length > 0);
    assert.ok(
      manifest.entries.every(
        (entry) =>
          entry.representativeQueries.length >= 2 && entry.representativeQueries.length <= 5,
      ),
    );
  }

  const headResponse = await worker.fetch(
    new Request('https://tools.pylot.dev/.well-known/ai-catalog.json', { method: 'HEAD' }),
  );

  assert.equal(await headResponse.text(), '');
  assert.equal(fetchCalls, 0);
});

test('sets content type for llms.txt', async (t) => {
  mockFetch(
    t,
    async () =>
      new Response('# 台灣交通違規簡訊報案工具', {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }),
  );

  const response = await worker.fetch(new Request('https://tools.pylot.dev/llms.txt'));

  assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
});

test('serves the exact built OAuth discovery documents', async (t) => {
  const sources = new Map([
    [
      '/.well-known/oauth-protected-resource',
      readFileSync('public/.well-known/oauth-protected-resource'),
    ],
    [
      '/.well-known/oauth-authorization-server',
      readFileSync('public/.well-known/oauth-authorization-server'),
    ],
  ]);
  let fetchCalls = 0;
  mockFetch(t, async (request) => {
    fetchCalls += 1;
    const path = new URL(request.url).pathname;
    const source = sources.get(path);
    assert.ok(source, `Unexpected OAuth document path: ${path}`);
    return new Response(source);
  });

  const metadataCases = [
    {
      path: '/.well-known/oauth-protected-resource',
      validate(metadata) {
        assert.equal(metadata.resource, 'https://tools.pylot.dev/');
        assert.deepEqual(metadata.scopes_supported, ['public']);
        assert.deepEqual(metadata.bearer_methods_supported, ['header']);
      },
    },
    {
      path: '/.well-known/oauth-authorization-server',
      validate(metadata) {
        assert.equal(metadata.issuer, 'https://tools.pylot.dev');
        assert.equal(metadata.agent_auth.skill, 'https://tools.pylot.dev/auth.md');
        assert.equal(metadata.agent_auth.register_uri, 'https://tools.pylot.dev/auth.md');
        assert.equal(
          metadata.agent_auth.claim_uri,
          'https://tools.pylot.dev/auth.md#anonymous--no-credential',
        );
        assert.deepEqual(metadata.agent_auth.identity_types_supported, ['anonymous']);
        assert.deepEqual(metadata.agent_auth.credential_types_supported, ['none']);
        assert.deepEqual(metadata.agent_auth.anonymous.credential_types_supported, ['none']);
      },
    },
  ];

  for (const metadataCase of metadataCases) {
    const response = await worker.fetch(new Request(`https://tools.pylot.dev${metadataCase.path}`));
    const body = await response.text();
    const source = sources.get(metadataCase.path);
    assert.ok(source);
    const metadata = JSON.parse(body);

    assert.equal(response.status, 200);
    assert.equal(body, source.toString('utf8'));
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD, OPTIONS');
    assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
    assert.equal(response.headers.get('X-Agent-Ready-Worker'), 'active');
    assert.deepEqual(metadata.authorization_servers, ['https://tools.pylot.dev']);
    metadataCase.validate(metadata);
  }

  assert.equal(fetchCalls, metadataCases.length);
});

test('replaces unsafe origin Link headers with static discovery links', async (t) => {
  const unsafeOriginLinkHeader = `${String.fromCodePoint(60)}/unsafe${String.fromCodePoint(
    62,
  )}; rel="preload"`;

  mockFetch(
    t,
    async () =>
      new Response('home', {
        headers: new Headers([
          ['Link', unsafeOriginLinkHeader],
          ['Vary', 'Accept-Encoding'],
        ]),
      }),
  );

  const response = await worker.fetch(
    new Request('https://tools.pylot.dev/', {
      headers: { Accept: 'text/html' },
    }),
  );
  const linkHeader = response.headers.get('Link') ?? '';

  assert.doesNotMatch(linkHeader, /unsafe/);
  assert.match(linkHeader, /rel="api-catalog"/);
  assert.equal(response.headers.get('Vary'), 'Accept-Encoding, Accept');
});

test('rejects unsafe requests before origin fetch', async (t) => {
  let fetchCalls = 0;
  mockFetch(t, async () => {
    fetchCalls += 1;
    return new Response('unexpected');
  });

  const untrustedHost = await worker.fetch(new Request('https://evil.example/'));
  const unsafePath = await worker.fetch(
    new Request('https://tools.pylot.dev/%252e%252e/index.html'),
  );
  const unsupportedMethod = await worker.fetch(
    new Request('https://tools.pylot.dev/', { method: 'POST' }),
  );

  assert.equal(untrustedHost.status, 404);
  assert.equal(unsafePath.status, 404);
  assert.equal(unsupportedMethod.status, 405);
  assert.equal(unsupportedMethod.headers.get('Allow'), 'GET, HEAD, OPTIONS');
  assert.equal(unsupportedMethod.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(fetchCalls, 0);
});

function mockFetch(t, handler) {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = previousFetch;
  });
}
