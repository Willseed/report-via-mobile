import aiCatalog from '../public/.well-known/ai-catalog.json' with { type: 'json' };
import siteCopy from '../site-copy.json' with { type: 'json' };

const LINK_TARGET_START = String.fromCodePoint(60);
const LINK_TARGET_END = String.fromCodePoint(62);
const BACKSLASH = String.fromCodePoint(92);

const PUBLIC_ORIGIN = siteCopy.url.replace(/\/$/, '');
const PUBLIC_HOSTNAME = new URL(PUBLIC_ORIGIN).hostname;
const HOMEPAGE_PATHS = new Set(['/', '/index.html']);
const MARKDOWN_HOMEPAGE_PATH = '/index.md';
const MARKDOWN_MEDIA_TYPE = 'text/markdown';
const WEB_PAGE_MEDIA_TYPE = 'text/html';
const AI_CATALOG_PATH = '/.well-known/ai-catalog.json';
const ARD_MANIFEST_PATH = '/.well-known/ard.json';
const SKILL_PATH = '/.well-known/agent-skills/report-via-mobile/SKILL.md';
const ARD_MANIFEST_METADATA = `${JSON.stringify(aiCatalog, null, 2)}\n`;
const ARD_DISCOVERY_DOCUMENT = Object.freeze({
  body: ARD_MANIFEST_METADATA,
  contentType: 'application/json; charset=utf-8',
  cacheControl: 'public, max-age=3600',
  allowCrossOrigin: true,
});
const OAUTH_PROTECTED_RESOURCE_PATH = '/.well-known/oauth-protected-resource';
const OAUTH_AUTHORIZATION_SERVER_PATH = '/.well-known/oauth-authorization-server';
const AUTH_MD_URL = `${PUBLIC_ORIGIN}/auth.md`;
const OAUTH_RESOURCE_METADATA_FIELDS = Object.freeze({
  resource: `${PUBLIC_ORIGIN}/`,
  authorization_servers: [PUBLIC_ORIGIN],
  scopes_supported: ['public'],
  bearer_methods_supported: ['header'],
});
const AGENT_AUTH_METADATA = Object.freeze({
  skill: AUTH_MD_URL,
  register_uri: AUTH_MD_URL,
  claim_uri: `${AUTH_MD_URL}#anonymous--no-credential`,
  identity_types_supported: ['anonymous'],
  credential_types_supported: ['none'],
  anonymous: {
    credential_types_supported: ['none'],
  },
});
const OAUTH_PROTECTED_RESOURCE_METADATA = `${JSON.stringify(
  {
    ...OAUTH_RESOURCE_METADATA_FIELDS,
    resource_name: siteCopy.name,
    resource_documentation: AUTH_MD_URL,
    notes: `公開靜態 PWA：anonymous 使用不需要 credential，也沒有受保護 API。${siteCopy.agentBoundary}`,
  },
  null,
  2,
)}\n`;
const OAUTH_AUTHORIZATION_SERVER_METADATA = `${JSON.stringify(
  {
    ...OAUTH_RESOURCE_METADATA_FIELDS,
    issuer: PUBLIC_ORIGIN,
    service_documentation: AUTH_MD_URL,
    agent_auth: AGENT_AUTH_METADATA,
  },
  null,
  2,
)}\n`;
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CORS_ALLOWED_METHODS = 'GET, HEAD, OPTIONS';
const SAFE_FORWARD_REQUEST_HEADERS = Object.freeze([
  'accept',
  'accept-encoding',
  'accept-language',
  'if-match',
  'if-modified-since',
  'if-none-match',
  'if-unmodified-since',
]);
const MAX_FORWARD_HEADER_VALUE_LENGTH = 1024;
const MAX_QUERY_LENGTH = 1024;
const MAX_ACCEPT_HEADER_LENGTH = 2048;
const MAX_ACCEPT_RANGES = 32;
const MAX_VARY_HEADER_LENGTH = 512;
const MAX_VARY_VALUES = 16;
const MEDIA_TOKEN_PATTERN = /^[a-z0-9!#$&^_.+-]+$/i;
const HEADER_TOKEN_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

const DISCOVERY_LINKS = [
  {
    target: AI_CATALOG_PATH,
    rel: 'ai-catalog',
    type: 'application/json',
  },
  {
    target: ARD_MANIFEST_PATH,
    rel: 'ard',
    type: 'application/json',
  },
  {
    target: '/.well-known/api-catalog',
    rel: 'api-catalog',
    type: 'application/linkset+json',
  },
  {
    target: '/.well-known/oauth-protected-resource',
    rel: 'describedby',
    type: 'application/json',
  },
  {
    target: '/.well-known/oauth-authorization-server',
    rel: 'service-desc',
    type: 'application/json',
  },
  {
    target: '/.well-known/agent-skills/index.json',
    rel: 'service-desc',
    type: 'application/json',
  },
  {
    target: '/.well-known/mcp/server-card.json',
    rel: 'service-desc',
    type: 'application/json',
  },
  {
    target: MARKDOWN_HOMEPAGE_PATH,
    rel: 'alternate service-doc',
    type: MARKDOWN_MEDIA_TYPE,
  },
  {
    target: '/llms.txt',
    rel: 'alternate',
    type: 'text/plain',
  },
  {
    target: '/manifest.webmanifest',
    rel: 'manifest',
    type: 'application/manifest+json',
  },
  {
    target: '/auth.md',
    rel: 'service-doc',
    type: MARKDOWN_MEDIA_TYPE,
  },
  {
    target: 'https://github.com/Willseed/report-via-mobile',
    rel: 'service-doc',
    type: WEB_PAGE_MEDIA_TYPE,
  },
];

const MARKDOWN_DISCOVERY_LINKS = [
  {
    target: '/',
    rel: 'canonical',
    type: WEB_PAGE_MEDIA_TYPE,
  },
  ...DISCOVERY_LINKS,
];

const CORS_DOCUMENT_PATHS = new Set(['/auth.md', '/index.md', '/llms.txt']);

const STATIC_CONTENT_TYPES = new Map([
  [AI_CATALOG_PATH, 'application/json; charset=utf-8'],
  [ARD_MANIFEST_PATH, 'application/json; charset=utf-8'],
  ['/.well-known/api-catalog', 'application/linkset+json; charset=utf-8'],
  ['/.well-known/oauth-protected-resource', 'application/json; charset=utf-8'],
  ['/.well-known/oauth-authorization-server', 'application/json; charset=utf-8'],
  ['/.well-known/agent-skills/index.json', 'application/json; charset=utf-8'],
  [SKILL_PATH, 'text/markdown; charset=utf-8'],
  ['/.well-known/mcp/server-card.json', 'application/json; charset=utf-8'],
  ['/auth.md', 'text/markdown; charset=utf-8'],
  ['/llms.txt', 'text/plain; charset=utf-8'],
  [MARKDOWN_HOMEPAGE_PATH, 'text/markdown; charset=utf-8'],
]);

const STATIC_DOCUMENTS = new Map([
  [AI_CATALOG_PATH, ARD_DISCOVERY_DOCUMENT],
  [ARD_MANIFEST_PATH, ARD_DISCOVERY_DOCUMENT],
  [
    OAUTH_PROTECTED_RESOURCE_PATH,
    {
      body: OAUTH_PROTECTED_RESOURCE_METADATA,
      contentType: 'application/json; charset=utf-8',
      allowCrossOrigin: true,
    },
  ],
  [
    OAUTH_AUTHORIZATION_SERVER_PATH,
    {
      body: OAUTH_AUTHORIZATION_SERVER_METADATA,
      contentType: 'application/json; charset=utf-8',
      allowCrossOrigin: true,
    },
  ],
]);

export default {
  async fetch(request) {
    const url = normalizeRequestUrl(request);

    if (!url) {
      return notFoundResponse();
    }

    if (!isSafeMethod(request.method)) {
      return methodNotAllowedResponse();
    }

    if (request.method.toUpperCase() === 'OPTIONS') {
      return isCorsDocumentPath(url.pathname)
        ? corsPreflightResponse()
        : methodNotAllowedResponse();
    }

    const staticDocumentResponse = serveStaticDocument(request, url.pathname);

    if (staticDocumentResponse) {
      return staticDocumentResponse;
    }

    if (shouldServeMarkdownHomepage(request, url.pathname)) {
      return fetchMarkdownHomepage(request.method);
    }

    const response = await fetchStaticAsset(request, url);

    if (!shouldDecorateResponse(url.pathname)) {
      return response;
    }

    const headers = new Headers(response.headers);
    const contentType = STATIC_CONTENT_TYPES.get(url.pathname);

    if (contentType) {
      headers.set('Content-Type', contentType);
    }

    if (isCorsDocumentPath(url.pathname)) {
      setCorsHeaders(headers);
    }

    if (HOMEPAGE_PATHS.has(url.pathname)) {
      setLinkHeader(headers, DISCOVERY_LINKS);
      appendVaryHeader(headers, 'Accept');
    }

    return cloneResponse(response, headers);
  },
};

function normalizeRequestUrl(request) {
  let url;

  try {
    url = new URL(request.url);
  } catch {
    return null;
  }

  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    url.hostname.toLowerCase() !== PUBLIC_HOSTNAME ||
    url.search.length > MAX_QUERY_LENGTH ||
    hasUnsafePathSegment(url.pathname)
  ) {
    return null;
  }

  const normalizedUrl = new URL(PUBLIC_ORIGIN);
  normalizedUrl.pathname = url.pathname;
  normalizedUrl.search = url.search;
  return normalizedUrl;
}

function hasUnsafePathSegment(pathname) {
  let currentPathname = pathname;

  try {
    for (let index = 0; index < 2; index += 1) {
      const decodedPathname = decodeURIComponent(currentPathname);

      if (decodedPathname.split('/').some((segment) => segment === '.' || segment === '..')) {
        return true;
      }

      if (decodedPathname === currentPathname) {
        return false;
      }

      currentPathname = decodedPathname;
    }

    return false;
  } catch {
    return true;
  }
}

function shouldDecorateResponse(pathname) {
  return (
    HOMEPAGE_PATHS.has(pathname) ||
    STATIC_CONTENT_TYPES.has(pathname) ||
    isCorsDocumentPath(pathname)
  );
}

function isCorsDocumentPath(pathname) {
  return CORS_DOCUMENT_PATHS.has(pathname) || pathname.startsWith('/.well-known/');
}

function shouldServeMarkdownHomepage(request, pathname) {
  return HOMEPAGE_PATHS.has(pathname) && prefersMarkdown(request.headers.get('Accept'));
}

function isSafeMethod(method) {
  return ALLOWED_METHODS.has(method.toUpperCase());
}

function fetchStaticAsset(request, url) {
  return fetch(
    new Request(url, {
      method: request.method.toUpperCase(),
      headers: safeForwardHeaders(request.headers),
      redirect: 'manual',
    }),
  );
}

function serveStaticDocument(request, pathname) {
  const document = STATIC_DOCUMENTS.get(pathname);

  if (!document) {
    return null;
  }

  const headers = new Headers({
    'Cache-Control': document.cacheControl ?? 'max-age=600',
    'Content-Type': document.contentType,
    'X-Agent-Ready-Worker': 'active',
  });

  if (document.allowCrossOrigin) {
    setCorsHeaders(headers);
  }

  return new Response(request.method.toUpperCase() === 'HEAD' ? null : document.body, {
    status: 200,
    headers,
  });
}

async function fetchMarkdownHomepage(method) {
  const response = await fetch(
    new Request(new URL(MARKDOWN_HOMEPAGE_PATH, PUBLIC_ORIGIN), {
      method: method.toUpperCase(),
      headers: new Headers({ Accept: MARKDOWN_MEDIA_TYPE }),
      redirect: 'manual',
    }),
  );
  const headers = new Headers(response.headers);

  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('Content-Location', MARKDOWN_HOMEPAGE_PATH);
  setCorsHeaders(headers);
  setLinkHeader(headers, MARKDOWN_DISCOVERY_LINKS);
  appendVaryHeader(headers, 'Accept');

  return new Response(method.toUpperCase() === 'HEAD' ? null : response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function cloneResponse(response, headers) {
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function safeForwardHeaders(requestHeaders) {
  const headers = new Headers();

  for (const headerName of SAFE_FORWARD_REQUEST_HEADERS) {
    const value = requestHeaders.get(headerName);

    if (isSafeForwardHeaderValue(value)) {
      headers.set(headerName, value);
    }
  }

  return headers;
}

function isSafeForwardHeaderValue(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= MAX_FORWARD_HEADER_VALUE_LENGTH &&
    !value.includes('\r') &&
    !value.includes('\n')
  );
}

function notFoundResponse() {
  return new Response('Not found', {
    status: 404,
    headers: new Headers({ 'Content-Type': 'text/plain; charset=utf-8' }),
  });
}

function corsPreflightResponse() {
  const headers = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': CORS_ALLOWED_METHODS,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': '0',
  });
  headers.delete('Access-Control-Allow-Credentials');
  return new Response(null, { status: 204, headers });
}

function setCorsHeaders(headers) {
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.delete('Access-Control-Allow-Credentials');
}

function methodNotAllowedResponse() {
  return new Response('Method not allowed', {
    status: 405,
    headers: new Headers({
      Allow: 'GET, HEAD, OPTIONS',
      'Content-Type': 'text/plain; charset=utf-8',
    }),
  });
}

function setLinkHeader(headers, links) {
  headers.set('Link', links.map(formatLink).join(', '));
}

function appendVaryHeader(headers, headerName) {
  const existingValues = parseSafeVaryValues(headers.get('Vary'));
  const normalizedHeaderName = headerName.toLowerCase();

  const alreadyVaries = existingValues.some(
    (value) => value.toLowerCase() === '*' || value.toLowerCase() === normalizedHeaderName,
  );

  if (alreadyVaries) {
    headers.set('Vary', existingValues.join(', '));
    return;
  }

  headers.set('Vary', [...existingValues, headerName].join(', '));
}

function parseSafeVaryValues(varyHeader) {
  if (!varyHeader || varyHeader.length > MAX_VARY_HEADER_LENGTH) {
    return [];
  }

  return varyHeader
    .split(',')
    .slice(0, MAX_VARY_VALUES)
    .map((part) => part.trim())
    .filter((part) => HEADER_TOKEN_PATTERN.test(part));
}

function formatLink({ target, rel, type }) {
  return [
    `${LINK_TARGET_START}${target}${LINK_TARGET_END}`,
    `rel="${escapeLinkParameter(rel)}"`,
    `type="${escapeLinkParameter(type)}"`,
  ].join('; ');
}

function escapeLinkParameter(value) {
  return value.replaceAll(BACKSLASH, String.raw`\\`).replaceAll('"', String.raw`\"`);
}

function prefersMarkdown(acceptHeader) {
  if (!acceptHeader || acceptHeader.length > MAX_ACCEPT_HEADER_LENGTH) {
    return false;
  }

  const acceptedTypes = parseAcceptHeader(acceptHeader);
  const explicitMarkdown = acceptedTypes.some(
    (entry) => entry.type === 'text' && entry.subtype === 'markdown' && entry.quality > 0,
  );

  if (!explicitMarkdown) {
    return false;
  }

  const markdown = getMediaPreference(acceptedTypes, 'text', 'markdown');
  const webPage = getMediaPreference(acceptedTypes, 'text', 'html');

  if (!markdown || markdown.quality <= 0) {
    return false;
  }

  if (!webPage || webPage.quality <= 0) {
    return true;
  }

  if (markdown.quality !== webPage.quality) {
    return markdown.quality > webPage.quality;
  }

  if (markdown.specificity !== webPage.specificity) {
    return markdown.specificity > webPage.specificity;
  }

  return markdown.index <= webPage.index;
}

function parseAcceptHeader(acceptHeader) {
  return acceptHeader
    .split(',')
    .slice(0, MAX_ACCEPT_RANGES)
    .map((entry, index) => parseAcceptEntry(entry, index))
    .filter((entry) => entry !== undefined);
}

function parseAcceptEntry(entry, index) {
  const [mediaRange, ...parameters] = entry.split(';').map((part) => part.trim());
  const [type, subtype, extra] = mediaRange.toLowerCase().split('/');

  if (extra !== undefined || !isSupportedMediaToken(type) || !isSupportedMediaToken(subtype)) {
    return undefined;
  }

  return {
    type,
    subtype,
    quality: parseQuality(parameters),
    specificity: getSpecificity(type, subtype),
    index,
  };
}

function isSupportedMediaToken(value) {
  return value === '*' || MEDIA_TOKEN_PATTERN.test(value);
}

function parseQuality(parameters) {
  for (const parameter of parameters.slice(0, 8)) {
    const separatorIndex = parameter.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = parameter.slice(0, separatorIndex).trim().toLowerCase();

    if (key !== 'q') {
      continue;
    }

    return normalizeQuality(parameter.slice(separatorIndex + 1));
  }

  return 1;
}

function normalizeQuality(rawValue) {
  const trimmedValue = rawValue.trim();
  const unquotedValue =
    trimmedValue.startsWith('"') && trimmedValue.endsWith('"')
      ? trimmedValue.slice(1, -1)
      : trimmedValue;
  const quality = Number(unquotedValue.trim());

  if (!Number.isFinite(quality)) {
    return 0;
  }

  return Math.min(1, Math.max(0, quality));
}

function getMediaPreference(acceptedTypes, type, subtype) {
  return acceptedTypes
    .filter((entry) => mediaRangeMatches(entry, type, subtype))
    .sort(
      (left, right) =>
        right.specificity - left.specificity ||
        right.quality - left.quality ||
        left.index - right.index,
    )[0];
}

function mediaRangeMatches(entry, type, subtype) {
  const typeMatches = entry.type === '*' || entry.type === type;
  const subtypeMatches = entry.subtype === '*' || entry.subtype === subtype;

  return typeMatches && subtypeMatches;
}

function getSpecificity(type, subtype) {
  if (type === '*') {
    return 0;
  }

  if (subtype === '*') {
    return 1;
  }

  return 2;
}
