# Copilot Instructions for report-via-mobile

## Commands

### Development
- **Dev server:** `npm start` or `ng serve` (http://localhost:4200/)
- **Build:** `ng build` (output: `dist/report-via-mobile/browser`)
- **Production build:** `ng build --configuration production`

### Testing
- **Run all tests:** `npm test` or `ng test`
- **Run single test file:** `ng test --include src/app/app.spec.ts`
- **Run tests in watch mode:** `ng test`

### Other
- **Watch mode build:** `ng build --watch --configuration development`

## Architecture

### Project Structure
- **Standalone components** — No NgModules. Components declare `imports: []` directly in `@Component()`.
- **Signals for state** — Use `signal()` and `computed()` for reactive state. Avoid RxJS subjects in components; prefer `toSignal()` for conversions.
- **Routing** — Configured in `src/app/app.routes.ts` using standalone routing with `HashLocationStrategy` (required for GitHub Pages).
- **Services** — Dependency injection via `inject()`. Examples: `GeocodingService` (Google Geocoding API), `SmsService` (SMS URI handling).
- **Material 3** — Angular Material components with CSS custom properties theming.

### Data Flow
- Components use standalone `imports` array instead of module declarations.
- Services are injected using `inject()` in component constructors.
- State flows through signals and computed properties, not observables (except for async data conversions via `toSignal()`).

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

### Styling
- **Preprocessor:** SCSS
- **Approach:** Component scoped styles via `styleUrl: './component.scss'`
- **Theming:** Material 3 tokens via CSS custom properties; avoid inline styles

### Localization
- **UI text:** All user-facing strings must be in Traditional Chinese (zh_TW)
- **Avoid:** Hard-coded English labels in templates

### Bundle Size
- **Production warning:** 500kB
- **Production error:** 1MB
- **Component style warning:** 4kB
- **Component style error:** 8kB

## Testing with Vitest

Tests use **Vitest + jsdom** (not Karma/Jasmine). Files follow the pattern `*.spec.ts`.

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

Key differences from Karma/Jasmine:
- Use `describe`/`it`/`expect` (same API)
- `TestBed` works the same
- No Karma configuration needed

## Deployment

- **Hosting:** GitHub Pages (static)
- **Routing:** Hash-based (`#/route`) to work without server rewrites
- **CI/CD:** GitHub Actions runs on push to `main` (see `.github/workflows/deploy.yml`)
  - Runs tests before building
  - Copies `index.html` to `404.html` for SPA routing

## Special Considerations

### GPS & Device APIs
- App uses device GPS (via `navigator.geolocation`) to auto-fill address
- SMS sending uses `sms:` URI scheme (works on mobile devices)
- Desktop detection via `SmsService.isDesktop()` to show limitations

### Police Station Mapping
- Hard-coded police station data in `src/app/police-stations.ts`
- Mapping by location (geocoding) and admin district
- Update this file when adding new districts or changing station info

### PWA Architecture (Angular 21 + @angular/pwa) — ⚠️ Planned, Not Yet Implemented

#### Core UX & Performance

- **Offline-First**: The application must display the App Shell when offline — never a blank page.
- **Installability**: Never prompt for installation on first load. Design a guided UI (e.g., a settings page or contextual banner) to trigger the install flow.
- **iOS Compatibility**: Supplement the Web App Manifest for Safari gaps — configure `apple-mobile-web-app-status-bar-style`, provide Apple Touch Icons, and handle back-button UI within the standalone experience.

#### Technical Implementation (`@angular/pwa`)

- **`ngsw-config.json` — AssetGroups**:
  - Core resources (`index.html`, `main.js`, CSS) must use `installMode: 'prefetch'`.
  - Non-core resources (lazy-loaded modules, images) must use `installMode: 'lazy'`.
- **`ngsw-config.json` — DataGroups**:
  - Frequently changing data (API responses) must use the `freshness` strategy (Network First).
  - Static or rarely changing content must use the `performance` strategy (Cache First).
- **Version Updates (`SwUpdate`)**:
  - **Do NOT** silently update or force-reload the page.
  - **Must** listen to `versionUpdates` events and notify users via a non-intrusive UI (SnackBar/Toast) with an explicit button to call `activateUpdate()`.

#### Deployment & CI/CD (GitHub Actions)

- **Cache Considerations**: GitHub Pages does not support custom HTTP headers. Rely on content-hash filenames (Angular default with `outputHashing: 'all'`) for cache busting. For `ngsw.json`, consider using a query parameter (e.g., `?v=<timestamp>`) if stale manifest issues occur.

### Google Geocoding
- Uses `GeocodingService` to reverse-geocode GPS coordinates to addresses
- API key should be in environment config (check `src/environments/`)
- Errors handled with user-facing feedback signals
