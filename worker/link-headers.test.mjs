import assert from 'node:assert/strict';
import test from 'node:test';

import worker from './link-headers.mjs';

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
    assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, HEAD');
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

test('serves OAuth discovery metadata from the edge', async (t) => {
  let fetchCalls = 0;
  mockFetch(t, async () => {
    fetchCalls += 1;
    return new Response('unexpected');
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
        assert.equal(metadata.agent_auth.claim_uri, 'https://tools.pylot.dev/auth.md#step-4--claim');
        assert.deepEqual(metadata.agent_auth.identity_types_supported, ['anonymous']);
        assert.deepEqual(metadata.agent_auth.credential_types_supported, ['none']);
        assert.deepEqual(metadata.agent_auth.anonymous.credential_types_supported, ['none']);
      },
    },
  ];

  for (const metadataCase of metadataCases) {
    const response = await worker.fetch(
      new Request(`https://tools.pylot.dev${metadataCase.path}`),
    );
    const metadata = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
    assert.equal(response.headers.get('X-Agent-Ready-Worker'), 'active');
    assert.deepEqual(metadata.authorization_servers, ['https://tools.pylot.dev']);
    metadataCase.validate(metadata);
  }

  assert.equal(fetchCalls, 0);
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
  assert.equal(unsupportedMethod.headers.get('Allow'), 'GET, HEAD');
  assert.equal(fetchCalls, 0);
});

function mockFetch(t, handler) {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = previousFetch;
  });
}
