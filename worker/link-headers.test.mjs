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

  assert.match(linkHeader, /rel="api-catalog"/);
  assert.match(linkHeader, /\/\.well-known\/oauth-protected-resource/);
  assert.match(linkHeader, /\/\.well-known\/agent-skills\/index\.json/);
  assert.match(linkHeader, /\/\.well-known\/mcp\/server-card\.json/);
  assert.match(linkHeader, /\/index\.md/);
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

test('replaces unsafe origin Link headers with static discovery links', async (t) => {
  mockFetch(
    t,
    async () =>
      new Response('home', {
        headers: {
          Link: '</unsafe>; rel="preload"',
          Vary: 'Accept-Encoding',
        },
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
