# Contributing to Report via Mobile

Thank you for helping improve this project. This guide describes the expected contribution process for code, documentation, tests, and data updates.

## Acceptable contributions

We welcome focused contributions such as:

- bug fixes
- tests and quality improvements
- accessibility and mobile UX improvements
- documentation updates
- refactors that simplify existing code without changing behavior
- police station data corrections **with an official source or citation**
- dependency updates that keep the app healthy and secure

## Before you start

1. Check whether an issue or pull request already covers the work.
2. For larger changes, open an issue first so scope and approach can be discussed.
3. For security vulnerabilities, follow [SECURITY.md](./SECURITY.md). Do **not** open a public issue with exploit details.

## Development setup

CI currently runs on Node.js 24 and npm 11. Matching that locally is recommended.

```bash
npm install
npm start
npm test
npm run lint
npm run lint:styles
```

Use `npm run e2e` when the change affects end-to-end user behavior.

## Project-specific coding standards

- Keep the app **standalone-component based**; do not introduce NgModules.
- Prefer **signals** and `inject()` for Angular state and dependency injection.
- Keep user-facing text in `src/app/i18n/zh-TW.ts`.
- Prefer small, cohesive services and avoid speculative abstractions.
- Treat all external data as untrusted input. Do not introduce raw HTML rendering or unsafe DOM APIs.
- Keep changes narrow in scope and update related docs when behavior or policy changes.
- Conventional Commits are preferred for commit messages.

## Tests are expected for new behavior

- New functionality should add or update automated tests.
- Bug fixes should include a regression test whenever practical.
- Changes to message composition, address normalization, station lookup, or security-sensitive behavior should have unit-test coverage at minimum.
- If a change cannot reasonably be covered by automated tests, explain that in the pull request.

## Pull request process

Please keep pull requests small, reviewable, and specific.

Each pull request should include:

- a clear summary of the change
- a linked issue when one exists
- test evidence (`npm test`, `npm run lint`, and other relevant checks)
- screenshots or short recordings for user-visible UI changes
- official reference links for police station data corrections

## Review and merge expectations

- `CODEOWNERS` currently routes repository review to `@Willseed`.
- Pull requests to `main` run CI in `.github/workflows/ci.yml`.
- End-to-end checks also run on pull requests in `.github/workflows/e2e.yml`.
- Maintainers should merge only after relevant checks are green and code-owner review is complete.
- If GitHub branch protection is not enforcing those checks automatically, maintainers must follow the same rule manually.

## Continuity note

This repository currently has a single active maintainer. Review and release capacity may therefore be limited. Adding another maintainer is recommended and requires repository-admin follow-up outside this file.
