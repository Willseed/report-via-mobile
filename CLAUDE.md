# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mobile-first Angular 21 application for reporting traffic violations via SMS. Users can geolocate their position, auto-detect the local police station, select a violation type, and generate an SMS message — all from their phone. Deployed to GitHub Pages at `tools.pylot.dev`.

## Common Commands

- **Dev server:** `ng serve` or `npm start` (http://localhost:4200/)
- **Build:** `ng build` (output: `dist/report-via-mobile/browser/`)
- **Run tests:** `ng test` (Vitest + jsdom)
- **Run single test:** `ng test --include src/app/sms-form/sms-form.spec.ts`
- **E2E tests:** `npm run e2e` (Playwright)
- **Lint styles:** `npm run lint:styles` (Stylelint)
- **Lint TS:** `npm run lint` (ESLint + angular-eslint)

## Architecture

- **Standalone components** — no NgModules. Components use `imports: []` directly in `@Component()`.
- **Signals** for reactive state (`signal()`, `computed()`), not RxJS subjects for component state.
- **Routing** configured in `app.routes.ts` with hash location strategy. `SmsForm` is loaded directly (not lazy-loaded). `ConfirmDialog` is lazy-loaded at call-site via dynamic `import()`.
- **SCSS** with Angular Material 3 theming (magenta/violet palette) via CSS custom properties.
- **Vitest** replaces Karma/Jasmine — tests use `describe`/`it`/`expect` with `TestBed`.
- **Playwright** for e2e tests (`e2e/` directory, `npm run e2e`).
- **CI/CD:** GitHub Actions — `ci.yml` (unit tests + build on PR), `deploy.yml` (tests + build + deploy on push to `main`), `e2e.yml` (Playwright), security scans (`codeql.yml`, `scorecard.yml`, `zap-baseline.yml`, `zap-full.yml`, `codacy.yml`).

## Key Files

- `src/app/app.ts` — Root component (`App`); bootstraps PWA services and ThemeService
- `src/app/app.config.ts` — App bootstrap config (hash location, Service Worker, HTTP client, global error listeners)
- `src/app/app.routes.ts` — Single route at root path pointing to `SmsForm`
- `src/app/sms-form/` — Main feature component (orchestrates location, violation, preview, confirm dialog)
  - `sms-form.ts` / `sms-form.html` / `sms-form.scss` — Root form component
  - `location-input/` — Address input + GPS locate + district lookup sub-component
  - `violation-input/` — Violation type selector + license plate input sub-component
  - `sms-preview/` — Live SMS message preview sub-component
  - `confirm-dialog.ts` — Confirmation dialog (lazy-loaded via dynamic `import()`)
- `src/app/sms.service.ts` — SMS link generation with Android/iOS URI scheme handling
- `src/app/geocoding.service.ts` — Geolocation API + OpenStreetMap Nominatim reverse geocoding (circuit breaker, retry, LRU cache)
- `src/app/police-stations.ts` — Police station data (`District` enum, `PoliceStation` interface, `POLICE_STATIONS` array, `StationLookupService`, `findStationByAddress`)
- `src/app/theme.service.ts` — Light/dark/auto theme management (signal-based, persisted in localStorage)
- `src/app/theme-toggle/` — Theme toggle button component
- `src/app/i18n/zh-TW.ts` — All user-facing UI strings in Traditional Chinese
- `src/app/i18n/address-normalization.ts` — Taiwan address normalization rules
- `src/app/pwa-update.service.ts` — Service Worker 版本更新提示（SwUpdate + SnackBar）
- `src/app/pwa-install.service.ts` — PWA 安裝提示（beforeinstallprompt + SnackBar）
- `ngsw-config.json` — Service Worker cache config

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

- TypeScript strict mode enabled (`strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`)
- Component selector prefix: `app-`
- Prettier: 100 char width, single quotes, angular HTML parser
- 2-space indentation (editorconfig)
- Production bundle budgets: 750kB warning, 1MB error (component style: 4kB warning, 8kB error)
- All user-facing UI text must be in Traditional Chinese (zh_TW) — add strings to `src/app/i18n/zh-TW.ts`
- Commit messages in Traditional Chinese following Conventional Commits format (feat, fix, refactor, test, ci, docs)
- Package manager: `npm` (npm@11.x, Node 24)

## PWA Architecture

- **Offline-First**: App Shell 離線可用，不顯示空白頁面。Service Worker 透過 `@angular/service-worker` 管理快取。
- **Installability**: 監聽 `beforeinstallprompt` 事件，透過 `PwaInstallService` 以 SnackBar 引導安裝，不在首次載入時自動彈出。
- **iOS Compatibility**: 設定 Apple Touch Icons、`apple-mobile-web-app-status-bar-style`、`apple-mobile-web-app-capable` meta tags。
- **Service Worker Updates**: `PwaUpdateService` 監聽 `SwUpdate.versionUpdates`，`VERSION_READY` 時以 SnackBar 通知用戶，提供顯式更新按鈕呼叫 `activateUpdate()`。
- **Cache Strategy**: 核心資源（index.html、JS、CSS）使用 `prefetch`，圖片/字型使用 `lazy`，Nominatim API 使用 `freshness` 策略（見 `ngsw-config.json`）。

## Testing Patterns

- Use `provideNoopAnimations()` and `provideHttpClientTesting()` in TestBed
- Mock browser APIs (`navigator.geolocation`, `navigator.userAgent`) with `vi.spyOn()` / `vi.fn()`
- E2E tests use Playwright (`npm run e2e`, `npm run e2e:ui`)
