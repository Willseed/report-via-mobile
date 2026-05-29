const HOMEPAGE_PATHS = new Set(['/', '/index.html']);
const HOMEPAGE_LINK_HEADER = [
  '</manifest.webmanifest>; rel="manifest"',
  '<https://github.com/Willseed/report-via-mobile>; rel="service-doc"',
].join(', ');

export default {
  async fetch(request) {
    const response = await fetch(request);

    if (!isHomepageRequest(request)) {
      return response;
    }

    const headers = new Headers(response.headers);
    appendHeader(headers, 'Link', HOMEPAGE_LINK_HEADER);

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
