# Report via Mobile

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/df9a6a592af94cb298384bede0f5ef7f)](https://app.codacy.com/gh/Willseed/report-via-mobile/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Willseed/report-via-mobile/badge)](https://securityscorecards.dev/viewer/?uri=github.com/Willseed/report-via-mobile)
![Build Status](https://github.com/Willseed/report-via-mobile/actions/workflows/ci.yml/badge.svg)
![CodeQL](https://github.com/Willseed/report-via-mobile/actions/workflows/codeql.yml/badge.svg)
![License](https://img.shields.io/github/license/Willseed/report-via-mobile)
![Dependabot](https://img.shields.io/badge/dependabot-enabled-blue?logo=dependabot)

行動裝置簡訊報案應用程式。使用者輸入事發地址或使用 GPS 定位後，應用程式會協助查找承辦警局、組合簡訊內容，並透過裝置原生簡訊功能（`sms:` URI scheme）交由使用者送出。

**工具網址：** [https://tools.pylot.dev](https://tools.pylot.dev)

## Quick links / 快速連結

| Topic | Link |
| --- | --- |
| Quick start | [Local development](#local-development) |
| Contribution process | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| Code of conduct | [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) |
| Governance | [GOVERNANCE.md](./GOVERNANCE.md) |
| Architecture | [docs/architecture.md](./docs/architecture.md) |
| 12-month roadmap | [docs/roadmap.md](./docs/roadmap.md) |
| Security requirements | [docs/security-requirements.md](./docs/security-requirements.md) |
| Assurance case | [docs/assurance-case.md](./docs/assurance-case.md) |
| Vulnerability reporting | [SECURITY.md](./SECURITY.md) |

## Current release: 1.0.0 (2026-03-13)

## What the app does

- **GPS 定位**：可取得目前位置並反查地址
- **行政區／警局對應**：依地址對應承辦警局與簡訊號碼
- **違規事實輸入**：支援快速篩選違規類型與車牌欄位
- **簡訊內容組合**：依地址、違規事實與車牌組成報案訊息
- **原生簡訊交接**：由使用者在裝置的 SMS App 中確認與發送
- **PWA**：支援安裝提示、版本更新通知與基本離線能力

## Tech stack

- **Framework:** Angular 21 (standalone components, signals, strict mode)
- **UI:** Angular Material 3
- **State:** Angular signals + injectable services
- **Testing:** Vitest + jsdom, Playwright
- **Hosting:** GitHub Pages (static site)
- **Geocoding:** OpenStreetMap Nominatim

## Local development

### Requirements

- Node.js 24.x recommended (matches CI); Angular 21 minimum is Node.js 20.19+
- npm 11.x

### Start the app

```bash
npm install
npm start
```

Open <http://localhost:4200/>.

### Common commands

```bash
npm test
npm run lint
npm run lint:styles
npm run e2e
npm run build
```

Production build output: `dist/report-via-mobile/browser`

For local bundle inspection without changing the deployed production build:

```bash
npm run build:analyze
```

## Contribution and review

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

Highlights:

- New functionality and bug fixes should include tests, or explain why automated tests are not practical.
- Pull requests to `main` must pass the required checks and receive an approving review before merge; while `main` does not enforce `require_code_owner_reviews`, maintainers should also ensure the review satisfies the documented `CODEOWNERS` policy.
- Security-sensitive reports should **not** be filed publicly; use [SECURITY.md](./SECURITY.md).

## Architecture and security notes

- High-level design: [docs/architecture.md](./docs/architecture.md)
- Security requirements and non-goals: [docs/security-requirements.md](./docs/security-requirements.md)
- Threat model and mitigations: [docs/assurance-case.md](./docs/assurance-case.md)
- Project direction: [docs/roadmap.md](./docs/roadmap.md)

## Deployment

Deployment is automated from `main` via GitHub Actions. The site is served as a static build on GitHub Pages.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
