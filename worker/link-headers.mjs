const HOMEPAGE_PATHS = new Set(['/', '/index.html']);
const HOMEPAGE_LINKS = [
  { target: '/manifest.webmanifest', rel: 'manifest' },
  { target: 'https://github.com/Willseed/report-via-mobile', rel: 'service-doc' },
];
const LINK_TARGET_START = String.fromCharCode(60);
const LINK_TARGET_END = String.fromCharCode(62);

export default {
  async fetch(request) {
    const response = await fetch(request);

    if (!isHomepageRequest(request)) {
      return response;
    }

    const headers = new Headers(response.headers);
    appendHeader(headers, 'Link', formatLinkHeader(HOMEPAGE_LINKS));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

function isHomepageRequest(request) {
  const { pathname } = new URL(request.url);

  return HOMEPAGE_PATHS.has(pathname);
}

function appendHeader(headers, name, value) {
  const currentValue = headers.get(name);

  headers.set(name, currentValue ? `${currentValue}, ${value}` : value);
}

function formatLinkHeader(links) {
  return links.map(({ target, rel }) => formatLink(target, rel)).join(', ');
}

function formatLink(target, rel) {
  return `${LINK_TARGET_START}${target}${LINK_TARGET_END}; rel="${rel}"`;
}
