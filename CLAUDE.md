# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Angular 21 mobile-first application using standalone component architecture, Angular Material 3, and Vitest for testing. Commit messages are written in Traditional Chinese.

## Common Commands

- **Dev server:** `ng serve` (http://localhost:4200/)
- **Build:** `ng build` (output: `dist/`)
- **Run tests:** `ng test` (Vitest + jsdom)
- **Run single test:** `npx vitest run src/app/app.spec.ts`

## Architecture

- **Standalone components** — no NgModules. Components use `imports: []` directly in `@Component()`.
- **Signals** for reactive state (`signal()`, `computed()`), not RxJS subjects for component state.
- **Routing** configured in `app.routes.ts` with lazy-loadable routes via `RouterOutlet`.
- **SCSS** with Angular Material 3 theming via CSS custom properties.
- **Vitest** replaces Karma/Jasmine — tests use `describe`/`it`/`expect` with `TestBed`.

## Code Conventions

- TypeScript strict mode enabled (`strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`)
- Component selector prefix: `app-`
- Prettier: 100 char width, single quotes, angular HTML parser
- 2-space indentation (editorconfig)
- Production bundle budgets: 500kB warning, 1MB error
- All user-facing UI text must be in Traditional Chinese (zh_TW)
