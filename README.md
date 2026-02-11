# Report via Mobile

A pure frontend web application that allows users to fill out message templates and trigger the native SMS app on mobile devices via the `sms:` URI scheme.

## Tech Stack

- **Framework:** Angular 21 (Standalone Components, Signals, Strict Mode)
- **UI:** Angular Material 3 (M3)
- **Styling:** SCSS
- **Routing:** HashLocationStrategy (GitHub Pages compatible)
- **Testing:** Vitest + jsdom
- **Hosting:** GitHub Pages (static)
- **Edge/Security:** Cloudflare (DNS, SSL, Headers)

## Development

```bash
npm install
ng serve
```

Open http://localhost:4200/

## Build

```bash
ng build
```

Output: `dist/report-via-mobile/browser`

## Testing

```bash
ng test
```

## Deployment

Deployment is automated via GitHub Actions on push to `main`. See `.github/workflows/deploy.yml`.

## Cloudflare Configuration

Since GitHub Pages does not support server-side header configuration, **Cloudflare Transform Rules** must be used to inject security headers for the domain `pylot.dev`.

### Rule: Response Header Modification

**Expression:** `(http.host eq "pylot.dev")`

Set the following **static response headers**:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `DENY` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self';` |

### CSP Notes

- `style-src 'unsafe-inline'` is required because Angular uses inline styles for component bindings.
- `script-src 'self'` — no `unsafe-inline` or `unsafe-eval` allowed.
- `frame-ancestors 'none'` — anti-clickjacking (also covered by `X-Frame-Options: DENY`).
- `form-action 'self'` — restricts form submissions.
