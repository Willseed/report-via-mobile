# AGENTS.md (Codex)

This file provides Codex-specific working guidance for this repository. It is distilled from
`CLAUDE.md` and `.github/copilot-instructions.md` to keep behavior consistent.

## Project Overview
- Mobile-first Angular 21 app for reporting traffic violations via SMS (GPS → district → station → SMS).
- Deployed to GitHub Pages at `tools.pylot.dev`.

## Common Commands
- Dev server: `npm start` or `ng serve` (http://localhost:4200)
- Build: `ng build` (output: `dist/report-via-mobile/browser/`)
- Production build: `ng build --configuration production`
- Unit tests: `npm test` or `ng test`
- Single test file: `ng test --include src/app/app.spec.ts`
- Coverage: `ng test --coverage`
- E2E: `npm run e2e` / `npm run e2e:ui` (Playwright)
- Lint TS: `npm run lint`
- Lint SCSS: `npm run lint:styles`

## Architecture Highlights
- **Standalone components**: no NgModules; use `@Component({ imports: [] })`.
- **Signals**: use `signal()` / `computed()` for state; avoid RxJS subjects in components.
- **Routing**: `src/app/app.routes.ts` with `HashLocationStrategy` (required for GitHub Pages).
- **Lazy load**: `ConfirmDialog` via dynamic `import()` at call site.
- **DI**: use `inject()`.
- **Angular Material 3**: theme via CSS custom properties.
- **i18n**: all UI strings live in `src/app/i18n/zh-TW.ts`.

## Key Files
- `src/app/app.ts`: root component; boots PWA and ThemeService
- `src/app/app.config.ts`: bootstrap config (hash routing, SW, HTTP, global errors)
- `src/app/app.routes.ts`: single route to `SmsForm`
- `src/app/sms-form/`: main feature (location, violation, preview, submit)
- `src/app/geocoding.service.ts`: GPS + Nominatim reverse geocode (circuit breaker, retry, LRU)
- `src/app/police-stations.ts`: station data + lookup service
- `src/app/sms.service.ts`: SMS URI generation (Android/iOS differences)
- `src/app/theme.service.ts`: theme state (signal + localStorage)

## Design Principles
- SOLID, high cohesion / low coupling
- Avoid over-engineering
- **Security rule**: never assign or pass raw HTML (e.g., `<script>`) to non-HTML variables/functions.
  If XSS test coverage is needed, use safe strings or comment intent.

## Coding Conventions
- TypeScript strict mode on (`noImplicitReturns`, `noFallthroughCasesInSwitch`)
- Component selector prefix: `app-`
- Prettier: 100 char width, single quotes, HTML parser = Angular
- 2-space indentation
- SCSS with component-scoped styles
- Bundle budgets: 750kB warning / 1MB error; component styles 4kB / 8kB
- Package manager: **npm only** (Node 24 / npm@11)
- **UI text must be Traditional Chinese** (zh-TW); add strings to `src/app/i18n/zh-TW.ts`

## Testing Standards
- **Vitest + jsdom** (not Karma/Jasmine)
- Use `provideNoopAnimations()` and `provideHttpClientTesting()` in TestBed
- Mock browser APIs via `vi.spyOn()` / `vi.fn()` (e.g., `navigator.geolocation`)

## PWA Rules
- Offline-first; avoid blank page
- Install prompt: `PwaInstallService` listens to `beforeinstallprompt`
- Update prompt: `PwaUpdateService` listens to `SwUpdate.versionUpdates`; only
  call `activateUpdate()` after explicit user action
- `ngsw-config.json` uses `prefetch/lazy` and `freshness` strategies

## Change Rules
- Preserve current architecture and style; do not add NgModules
- If adding UI text, update i18n file first, then reference it
- Never embed raw HTML strings into non-HTML variables
