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

test('serves the markdown homepage when text markdown is preferred', async (t) => {
  let requestedPath = '';
  mockFetch(t, async (request) => {
    requestedPath = new URL(request.url).pathname;

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

test('keeps HTML homepage when HTML is preferred over markdown', async (t) => {
  let requestedPath = '';
  mockFetch(t, async (request) => {
    requestedPath = new URL(request.url).pathname;

    return new Response('home');
  });

  const response = await worker.fetch(
    new Request('https://tools.pylot.dev/', {
      headers: {
        Accept: 'text/html, text/markdown;q=0.5',
      },
    }),
  );

  assert.equal(requestedPath, '/');
  assert.equal(await response.text(), 'home');
});

test('keeps HTML homepage when markdown is not explicitly accepted', async (t) => {
  let requestedPath = '';
  mockFetch(t, async (request) => {
    requestedPath = new URL(request.url).pathname;

    return new Response('home');
  });

  const response = await worker.fetch(
    new Request('https://tools.pylot.dev/', {
      headers: {
        Accept: '*/*',
      },
    }),
  );

  assert.equal(requestedPath, '/');
  assert.equal(await response.text(), 'home');
});

test('keeps HTML homepage when markdown has zero quality', async (t) => {
  let requestedPath = '';
  mockFetch(t, async (request) => {
    requestedPath = new URL(request.url).pathname;

    return new Response('home');
  });

  const response = await worker.fetch(
    new Request('https://tools.pylot.dev/', {
      headers: {
        Accept: 'text/markdown; q = 0, text/html;q=0.2',
      },
    }),
  );

  assert.equal(requestedPath, '/');
  assert.equal(await response.text(), 'home');
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

function mockFetch(t, handler) {
  const previousFetch = globalThis.fetch;

  globalThis.fetch = handler;
  t.after(() => {
    globalThis.fetch = previousFetch;
  });
}
