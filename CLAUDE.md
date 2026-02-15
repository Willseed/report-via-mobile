# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mobile-first Angular 21 application for reporting traffic violations via SMS. Users can geolocate their position, auto-detect the local police station, select a violation type, and generate an SMS message — all from their phone. Deployed to GitHub Pages at `tools.pylot.dev`.

## Common Commands

- **Dev server:** `ng serve` (http://localhost:4200/)
- **Build:** `ng build` (output: `dist/report-via-mobile/browser/`)
- **Run tests:** `ng test` (Vitest + jsdom)
- **Run single test:** `ng test --include src/app/sms-form/sms-form.spec.ts`

## Architecture

- **Standalone components** — no NgModules. Components use `imports: []` directly in `@Component()`.
- **Signals** for reactive state (`signal()`, `computed()`), not RxJS subjects for component state.
- **Routing** configured in `app.routes.ts` with lazy-loadable routes via `RouterOutlet` and hash location strategy.
- **SCSS** with Angular Material 3 theming (magenta/violet palette) via CSS custom properties.
- **Vitest** replaces Karma/Jasmine — tests use `describe`/`it`/`expect` with `TestBed`.
- **CI/CD:** GitHub Actions deploys to GitHub Pages on push to `main`; tests must pass before deploy.

## Key Files

- `src/app/sms-form/` — Main feature component (form, template, styles, tests)
- `src/app/sms.service.ts` — SMS link generation with Android/iOS URI scheme handling
- `src/app/geocoding.service.ts` — Geolocation API + OpenStreetMap Nominatim reverse geocoding
- `src/app/police-stations.ts` — Police station data (District enum, phone numbers, address matching)
- `src/app/pwa-update.service.ts` — Service Worker 版本更新提示（SwUpdate + SnackBar）
- `src/app/pwa-install.service.ts` — PWA 安裝提示（beforeinstallprompt + SnackBar）
- `src/app/app.routes.ts` — Single lazy-loaded route at root path
- `src/app/app.config.ts` — App bootstrap config (hash location, animations, HTTP client)

## Design Principles

- Follow **SOLID** principles:
  - **Single Responsibility:** Each class/function should have only one reason to change
  - **Open/Closed:** Open for extension, closed for modification
  - **Liskov Substitution:** Subtypes must be substitutable for their base types
  - **Interface Segregation:** Prefer small, focused interfaces over large ones
  - **Dependency Inversion:** Depend on abstractions, not concretions
- **High Cohesion, Low Coupling:** Keep related logic together within a module; minimize direct dependencies between modules by interacting through well-defined interfaces
- **No Over-Engineering:** Keep solutions simple and focused on current requirements; avoid premature abstractions, speculative generality, or unnecessary indirection

## Code Conventions

- TypeScript strict mode enabled (`strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`)
- Component selector prefix: `app-`
- Prettier: 100 char width, single quotes, angular HTML parser
- 2-space indentation (editorconfig)
- Production bundle budgets: 500kB warning, 1MB error
- All user-facing UI text must be in Traditional Chinese (zh_TW)
- Commit messages in Traditional Chinese following Conventional Commits format (feat, fix, refactor, test, ci, docs)

## PWA Architecture

- **Offline-First**: App Shell 離線可用，不顯示空白頁面。Service Worker 透過 `@angular/service-worker` 管理快取。
- **Installability**: 監聽 `beforeinstallprompt` 事件，透過 `PwaInstallService` 以 SnackBar 引導安裝，不在首次載入時自動彈出。
- **iOS Compatibility**: 設定 Apple Touch Icons、`apple-mobile-web-app-status-bar-style`、`apple-mobile-web-app-capable` meta tags。
- **Service Worker Updates**: `PwaUpdateService` 監聽 `SwUpdate.versionUpdates`，`VERSION_READY` 時以 SnackBar 通知用戶，提供顯式更新按鈕呼叫 `activateUpdate()`。
- **Cache Strategy**: 核心資源（index.html、JS、CSS）使用 `prefetch`，圖片/字型使用 `lazy`，Nominatim API 使用 `freshness` 策略。

## Testing Patterns

- Use `provideNoopAnimations()` and `provideHttpClientTesting()` in TestBed
- Mock browser APIs (`navigator.geolocation`, `navigator.userAgent`) with `vi.spyOn()` / `vi.fn()`
- 85+ test cases across components and services
