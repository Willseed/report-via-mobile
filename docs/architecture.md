# Architecture

## System overview

`report-via-mobile` is a static Angular 21 web application, delivered as a PWA on GitHub Pages. It helps a user compose a traffic-report SMS and hands that message to the device's native SMS app.

There is **no application backend** for storing reports, accounts, or case data.

```text
User
  │
  ▼
Angular PWA (GitHub Pages)
  ├─ Browser Geolocation API
  ├─ OpenStreetMap Nominatim (reverse geocoding)
  ├─ Local police-station dataset + address normalization
  └─ sms: URI handoff to native SMS app
```

## Main runtime pieces

- **`App`**: bootstraps routing, theming, PWA install/update services.
- **`SmsForm`**: main workflow container.
- **`LocationInput`**: address entry, GPS locate, district lookup.
- **`ViolationInput`**: violation selection and optional license plate entry.
- **`SmsPreview`**: live preview of the generated message.
- **`ConfirmDialog`**: user confirmation before SMS handoff.

## Service layer

- **`GeocodingService`**: browser geolocation, Nominatim reverse geocoding, timeout/retry, circuit breaker, small cache.
- **`StationLookupService`**: maps normalized address text to the correct police station record.
- **`ReportStateService`**: exposes the composed workflow state through signals.
- **`MessageComposerService`**: derives the final SMS content and mismatch warnings.
- **`SmsService`**: sanitizes the SMS body and generates the platform-appropriate `sms:` link.
- **PWA services**: notify users about installation and available updates.

## Data flow

1. The user enters an address manually or requests device location.
2. If location is used, the browser asks for permission and the app reverse-geocodes coordinates with Nominatim.
3. The address is normalized and matched against the local station dataset.
4. The user selects the violation type and optionally enters a license plate.
5. The app composes a text message locally and shows a preview.
6. After explicit confirmation, the app opens the native SMS app with a prefilled message.

## Deployment and operations

- **Hosting:** GitHub Pages static deployment
- **CI:** GitHub Actions builds and tests pull requests and `main`
- **Unit tests:** Vitest + jsdom
- **E2E tests:** Playwright

## Design constraints

- Mobile-first UX
- Traditional Chinese user-facing strings
- No server-side case management
- Hash-based routing for GitHub Pages compatibility
