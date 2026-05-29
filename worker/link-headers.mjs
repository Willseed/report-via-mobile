const LINK_TARGET_START = String.fromCodePoint(60);
const LINK_TARGET_END = String.fromCodePoint(62);

const HOMEPAGE_PATHS = new Set(['/', '/index.html']);
const MARKDOWN_HOMEPAGE_PATH = '/index.md';

const DISCOVERY_LINKS = [
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
    type: 'text/markdown',
  },
  {
    target: '/manifest.webmanifest',
    rel: 'manifest',
    type: 'application/manifest+json',
  },
  {
    target: '/auth.md',
    rel: 'service-doc',
    type: 'text/markdown',
  },
  {
    target: 'https://github.com/Willseed/report-via-mobile',
    rel: 'service-doc',
    type: 'text/html',
  },
];

const MARKDOWN_DISCOVERY_LINKS = [
  {
    target: '/',
    rel: 'canonical',
    type: 'text/html',
  },
  ...DISCOVERY_LINKS,
];

const STATIC_CONTENT_TYPES = new Map([
  ['/.well-known/api-catalog', 'application/linkset+json; charset=utf-8'],
  ['/.well-known/oauth-protected-resource', 'application/json; charset=utf-8'],
  ['/.well-known/agent-skills/index.json', 'application/json; charset=utf-8'],
  ['/.well-known/mcp/server-card.json', 'application/json; charset=utf-8'],
  ['/auth.md', 'text/markdown; charset=utf-8'],
  [MARKDOWN_HOMEPAGE_PATH, 'text/markdown; charset=utf-8'],
]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = normalizePathname(url.pathname);

    if (shouldServeMarkdownHomepage(request, pathname)) {
      return fetchMarkdownHomepage(request, url);
    }

    const response = await fetch(request);

    if (!shouldDecorateResponse(pathname)) {
      return response;
    }

    const headers = new Headers(response.headers);
    const contentType = STATIC_CONTENT_TYPES.get(pathname);

    if (contentType) {
      headers.set('Content-Type', contentType);
    }

    if (HOMEPAGE_PATHS.has(pathname)) {
      appendLinkHeader(headers, DISCOVERY_LINKS);
      appendVaryHeader(headers, 'Accept');
    }

    return cloneResponse(response, headers);
  },
};

function normalizePathname(pathname) {
  return pathname === '' ? '/' : pathname;
}

function shouldDecorateResponse(pathname) {
  return HOMEPAGE_PATHS.has(pathname) || STATIC_CONTENT_TYPES.has(pathname);
}

function shouldServeMarkdownHomepage(request, pathname) {
  return (
    isSafeMethod(request.method) &&
    HOMEPAGE_PATHS.has(pathname) &&
    prefersMarkdown(request.headers.get('Accept'))
  );
}

function isSafeMethod(method) {
  return method === 'GET' || method === 'HEAD';
}

async function fetchMarkdownHomepage(request, url) {
  const markdownUrl = new URL(url);
  markdownUrl.pathname = MARKDOWN_HOMEPAGE_PATH;
  markdownUrl.search = '';

  const response = await fetch(new Request(markdownUrl, request));
  const headers = new Headers(response.headers);

  headers.set('Content-Type', 'text/markdown; charset=utf-8');
  headers.set('Content-Location', MARKDOWN_HOMEPAGE_PATH);
  appendLinkHeader(headers, MARKDOWN_DISCOVERY_LINKS);
  appendVaryHeader(headers, 'Accept');

  return new Response(request.method === 'HEAD' ? null : response.body, {
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

function appendLinkHeader(headers, links) {
  const linkHeader = links.map(formatLink).join(', ');
  const existingLink = headers.get('Link');

  headers.set('Link', existingLink ? `${existingLink}, ${linkHeader}` : linkHeader);
}

function appendVaryHeader(headers, headerName) {
  const existingVary = headers.get('Vary');

  if (!existingVary) {
    headers.set('Vary', headerName);
    return;
  }

  const varyParts = existingVary.split(',').map((part) => part.trim().toLowerCase());

  if (varyParts.includes('*') || varyParts.includes(headerName.toLowerCase())) {
    return;
  }

  headers.set('Vary', `${existingVary}, ${headerName}`);
}

function formatLink({ target, rel, type }) {
  return [
    `${LINK_TARGET_START}${target}${LINK_TARGET_END}`,
    `rel="${escapeLinkParameter(rel)}"`,
    `type="${escapeLinkParameter(type)}"`,
  ].join('; ');
}

function escapeLinkParameter(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function prefersMarkdown(acceptHeader) {
  if (!acceptHeader) {
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
  const html = getMediaPreference(acceptedTypes, 'text', 'html');

  if (!markdown || markdown.quality <= 0) {
    return false;
  }

  if (!html || html.quality <= 0) {
    return true;
  }

  if (markdown.quality !== html.quality) {
    return markdown.quality > html.quality;
  }

  if (markdown.specificity !== html.specificity) {
    return markdown.specificity > html.specificity;
  }

  return markdown.index <= html.index;
}

function parseAcceptHeader(acceptHeader) {
  return acceptHeader
    .split(',')
    .map((entry, index) => parseAcceptEntry(entry, index))
    .filter((entry) => entry !== undefined);
}

function parseAcceptEntry(entry, index) {
  const [mediaRange, ...parameters] = entry.split(';').map((part) => part.trim());
  const [type, subtype] = mediaRange.toLowerCase().split('/');

  if (!type || !subtype) {
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

function parseQuality(parameters) {
  const qualityMatch = parameters
    .map((parameter) => /^q\s*=\s*"?([^"]*)"?$/i.exec(parameter))
    .find((match) => match !== null);

  if (!qualityMatch) {
    return 1;
  }

  const [, value] = qualityMatch;
  const quality = Number(value.trim());

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
