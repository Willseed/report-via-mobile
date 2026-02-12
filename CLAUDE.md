# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mobile-first Angular 21 application for reporting traffic violations via SMS. Users can geolocate their position, auto-detect the local police station, select a violation type, and generate an SMS message — all from their phone. Deployed to GitHub Pages at `tools.pylot.dev`.

## Common Commands

- **Dev server:** `ng serve` (http://localhost:4200/)
- **Build:** `ng build` (output: `dist/report-via-mobile/browser/`)
- **Run tests:** `ng test` (Vitest + jsdom)
- **Run single test:** `npx vitest run src/app/sms-form/sms-form.spec.ts`

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
- `src/app/app.routes.ts` — Single lazy-loaded route at root path
- `src/app/app.config.ts` — App bootstrap config (hash location, animations, HTTP client)

## Code Conventions

- TypeScript strict mode enabled (`strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`)
- Component selector prefix: `app-`
- Prettier: 100 char width, single quotes, angular HTML parser
- 2-space indentation (editorconfig)
- Production bundle budgets: 500kB warning, 1MB error
- All user-facing UI text must be in Traditional Chinese (zh_TW)
- Commit messages in Traditional Chinese following Conventional Commits format (feat, fix, refactor, test, ci, docs)

## Testing Patterns

- Use `provideNoopAnimations()` and `provideHttpClientTesting()` in TestBed
- Mock browser APIs (`navigator.geolocation`, `navigator.userAgent`) with `vi.spyOn()` / `vi.fn()`
- 85+ test cases across components and services
