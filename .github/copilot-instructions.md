# Copilot Instructions for report-via-mobile

## Commands

### Development
- **Dev server:** `npm start` or `ng serve` (http://localhost:4200/)
- **Build:** `ng build` (output: `dist/report-via-mobile/browser`)
- **Production build:** `ng build --configuration production`

### Testing
- **Run all unit tests:** `npm test` or `ng test`
- **Run single test file:** `ng test --include src/app/app.spec.ts`
- **Run tests with coverage:** `ng test --coverage`
- **E2E tests:** `npm run e2e` or `npm run e2e:ui` (Playwright)

### Linting
- **Lint TypeScript:** `npm run lint` (ESLint + angular-eslint)
- **Lint styles:** `npm run lint:styles` (Stylelint)

### Other
- **Watch mode build:** `ng build --watch --configuration development`

## Architecture

### Project Structure
- **Standalone components** — No NgModules. Components declare `imports: []` directly in `@Component()`.
- **Signals for state** — Use `signal()` and `computed()` for reactive state. Avoid RxJS subjects in components. Use `toSignal()` if bridging an Observable to a signal is needed (currently unused in the codebase).
- **Zoneless-first** — Angular 22 should be treated as zoneless-first. Avoid assumptions that ZoneJS is present, and prefer Angular reactivity/render APIs over zone-stability hooks.
- **Routing** — Configured in `src/app/app.routes.ts` using `HashLocationStrategy` (required for GitHub Pages). `SmsForm` is loaded directly. `ConfirmDialog` is lazy-loaded at call-site via dynamic `import()`.
- **Services** — Dependency injection via `inject()`.
- **Material 3** — Angular Material components with CSS custom properties theming.
- **i18n** — All user-facing strings live in `src/app/i18n/zh-TW.ts`; import `ZH_TW` where needed.

### Component Tree
```
App (app.ts)
├── ThemeToggle (theme-toggle/)
└── RouterOutlet → SmsForm (sms-form/)
    ├── LocationInput (location-input/)
    ├── ViolationInput (violation-input/)
    ├── SmsPreview (sms-preview/)
    └── ConfirmDialog (confirm-dialog.ts, lazy-loaded on submit)
```

### Key Services
- `GeocodingService` — Geolocation API + OpenStreetMap Nominatim reverse geocoding; includes circuit breaker, retry logic, and LRU cache
- `SmsService` — SMS URI generation (`sms:` scheme), Android/iOS handling, desktop detection
- `StationLookupService` — Memoized address-to-police-station lookup (lives in `police-stations.ts`)
- `ThemeService` — Light/dark/auto theme management, signal-based, persisted in localStorage
- `PwaUpdateService` — Listens to `SwUpdate.versionUpdates`, notifies user via SnackBar on `VERSION_READY`
- `PwaInstallService` — Listens to `beforeinstallprompt`, guides install via SnackBar

### Data Flow
- Components use standalone `imports` array instead of module declarations.
- Services are injected using `inject()` in component constructors or class bodies.
- State flows through signals and computed properties. Async data (e.g., geocoding) uses `Promise` via `firstValueFrom()`, not Observables directly in components.
- If code needs to wait for rendering or DOM reads/writes, prefer Angular render hooks such as `afterNextRender()` / `afterEveryRender()` instead of `NgZone.onStable`-style timing assumptions.

## Design Principles

- Follow **SOLID** principles:
  - **Single Responsibility:** Each class/function should have only one reason to change
  - **Open/Closed:** Open for extension, closed for modification
  - **Liskov Substitution:** Subtypes must be substitutable for their base types
  - **Interface Segregation:** Prefer small, focused interfaces over large ones
  - **Dependency Inversion:** Depend on abstractions, not concretions
- **High Cohesion, Low Coupling:** Keep related logic together within a module; minimize direct dependencies between modules by interacting through well-defined interfaces
- **No Over-Engineering:** Keep solutions simple and focused on current requirements; avoid premature abstractions, speculative generality, or unnecessary indirection
- **Security Rule:** Never assign or pass raw HTML (e.g., <script>) to non-HTML variables or functions in tests or code. If XSS test coverage is needed, use safe string values or document intent with comments.

## Code Conventions

### Formatting
- **Line width:** 100 characters (Prettier)
- **Quotes:** Single quotes
- **Indentation:** 2 spaces
- **Trailing whitespace:** Trimmed
- **HTML parser:** Angular (for `.html` files)

### TypeScript
- **Strict mode** enabled (`strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`)
- **Component selectors:** Prefix with `app-` (e.g., `app-sms-form`)
- **Null/undefined:** Handle explicitly; strict mode enforces this
- **HTTP setup:** Prefer `provideHttpClient()` and functional interceptors; do not reintroduce `HttpClientModule` or DI-first interceptor patterns unless there is a clear repo-specific reason.

### Styling
- **Preprocessor:** SCSS
- **Approach:** Component scoped styles via `styleUrl: './component.scss'`
- **Theming:** Material 3 tokens via CSS custom properties; avoid inline styles

### Localization
- **UI text:** All user-facing strings must be in Traditional Chinese (zh_TW)
- **Where to add strings:** `src/app/i18n/zh-TW.ts` — import via `import { ZH_TW } from './i18n'` (adjust relative path based on file depth)
- **Avoid:** Hard-coded Chinese or English labels in templates

### Bundle Size
- **Production warning:** 750kB
- **Production error:** 1MB
- **Component style warning:** 4kB
- **Component style error:** 8kB

### Package Manager
- **Use `npm`** (npm@11.x, Node 24); do not use yarn or pnpm

## Testing with Vitest

Unit tests use **Vitest + jsdom** (not Karma/Jasmine). Files follow the pattern `*.spec.ts`.

```typescript
import { TestBed } from '@angular/core/testing';
import { MyComponent } from './my.component';

describe('MyComponent', () => {
  it('should render', () => {
    const component = TestBed.createComponent(MyComponent);
    expect(component).toBeTruthy();
  });
});
```

Key patterns:
- Use `provideNoopAnimations()` and `provideHttpClientTesting()` in TestBed providers
- Prefer tests that stay compatible with zoneless change detection; add `provideZonelessChangeDetection()` when aligning a testbed with production behavior matters.
- Mock browser APIs with `vi.spyOn()` / `vi.fn()` (e.g., `navigator.geolocation`, `navigator.userAgent`)
- No Karma configuration needed

## E2E Testing with Playwright

E2E tests live in `e2e/` and use **Playwright**.

```bash
npm run e2e        # headless
npm run e2e:ui     # interactive UI
```

## Deployment

- **Hosting:** GitHub Pages (static)
- **Routing:** Hash-based (`#/route`) to work without server rewrites
- **CI/CD:** GitHub Actions workflows:
  - `ci.yml` — Runs on PRs to `main`: unit tests + production build
  - `deploy.yml` — Runs on push to `main`: tests → build → copy `404.html` → deploy
  - `e2e.yml` — Playwright e2e tests
  - `codeql.yml`, `scorecard.yml`, `zap-baseline.yml`, `zap-full.yml`, `codacy.yml` — Security & quality scans

## Special Considerations

### GPS & Device APIs
- App uses device GPS (via `navigator.geolocation`) to auto-fill address
- SMS sending uses `sms:` URI scheme (works on mobile devices)
- Desktop detection via `SmsService.isDesktop()` to show limitations

### Police Station Mapping
- Data in `src/app/police-stations.ts`: `District` enum (22 counties/cities), `POLICE_STATIONS` array, `StationLookupService`
- Matching by district name extracted from reverse-geocoded address
- Update this file when adding new districts or changing station info

### Geocoding
- Uses `GeocodingService` to reverse-geocode GPS coordinates via **OpenStreetMap Nominatim**
- Includes circuit breaker (3 failures → 30s cooldown), 1-retry, and LRU cache (max 100 entries)
- No API key required; sends `User-Agent` header per Nominatim policy

### PWA Architecture (`@angular/pwa`)

#### Core UX & Performance
- **Offline-First**: App Shell is available offline — never a blank page.
- **Installability**: `PwaInstallService` listens to `beforeinstallprompt`; shows SnackBar install prompt (not on first load).
- **iOS Compatibility**: Apple Touch Icons, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-capable` configured in `index.html`.

#### Technical Implementation
- **`ngsw-config.json` — AssetGroups**:
  - Core resources (`index.html`, JS, CSS): `installMode: 'prefetch'`
  - Images/fonts: `installMode: 'lazy'`, `updateMode: 'prefetch'`
- **`ngsw-config.json` — DataGroups**:
  - Nominatim API (`nominatim-api`): `strategy: 'freshness'`, max 50 entries, 1d TTL, 5s timeout
- **Version Updates (`SwUpdate`)**:
  - **Do NOT** silently update or force-reload the page.
  - `PwaUpdateService` listens to `versionUpdates`, shows SnackBar with explicit button calling `activateUpdate()`.

#### Deployment & CI/CD
- GitHub Pages does not support custom HTTP headers. Rely on content-hash filenames (`outputHashing: 'all'`) for cache busting.
