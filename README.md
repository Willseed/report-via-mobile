# Report via Mobile

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/df9a6a592af94cb298384bede0f5ef7f)](https://app.codacy.com/gh/Willseed/report-via-mobile/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Willseed/report-via-mobile/badge)](https://securityscorecards.dev/viewer/?uri=github.com/Willseed/report-via-mobile)
![Build Status](https://github.com/Willseed/report-via-mobile/actions/workflows/ci.yml/badge.svg)
![CodeQL](https://github.com/Willseed/report-via-mobile/actions/workflows/codeql.yml/badge.svg)
![License](https://img.shields.io/github/license/Willseed/report-via-mobile)
![Dependabot](https://img.shields.io/badge/dependabot-enabled-blue?logo=dependabot)

行動裝置簡訊報案應用程式。使用者填寫事發地址、選擇行政區與違規事實後，自動組合簡訊內容並透過裝置原生簡訊功能（`sms:` URI scheme）發送至對應警局。

## 專案特色

- 無需手動輸入地址——GPS 一鍵定位自動填入
- 無需查詢警局電話——根據地點自動對應承辦警局
- 無需自組簡訊——APP 自動產生通順的報案內容
- 支援行動裝置原生簡訊功能（`sms:` URI）直接發送

**工具網址：** [簡訊報案](https://tools.pylot.dev)

## 功能特色

- **GPS 定位** — 一鍵取得目前位置，自動填入地址並帶入對應行政區
- **行政區自動對應** — 根據地址自動選擇承辦警局與簡訊號碼
- **違規事實篩選** — 以 autocomplete 輸入框快速篩選違規類型（汽車/機車 × 各類違規）
- **簡訊自動組合** — 依據地址與違規事實自動產生語句通順的簡訊內容（如：「○○路100號，有機車於紅線停車，請派員處理」）
- **即時預覽** — 填寫完成後即時顯示簡訊氣泡預覽
- **Mobile-first** — 針對行動裝置最佳化的 UI 設計

## Tech Stack

- **Framework:** Angular 21 (Standalone Components, Signals, Strict Mode)
- **UI:** Angular Material 3 (M3)
- **PWA:** @angular/pwa（離線支援、安裝提示、版本更新通知）
- **Styling:** SCSS
- **Routing:** HashLocationStrategy (GitHub Pages compatible)
- **Testing:** Vitest + jsdom
- **Hosting:** GitHub Pages (static)
- **Geocoding API:** OpenStreetMap Nominatim

## 安裝環境需求

- Node.js >= 20.19.0 (Angular 21 requirement)
- npm >= 11.6.2

## Development

```bash
npm install
ng serve
```

Open http://localhost:4200/

## Build

```bash
ng build
```

Output: `dist/report-via-mobile/browser`

## Testing

```bash
ng test
```

## Deployment

Deployment is automated via GitHub Actions on push to `main`. See `.github/workflows/deploy.yml`.

## 貢獻方式

歡迎提出 Issue 或 Pull Request。請遵循專案規範與 commit 格式（Conventional Commits，中文提交訊息）。

有安全漏洞發現？請參閱 [SECURITY.md](./SECURITY.md) 進行私下回報。

## License

本專案採用 MIT License，詳見 LICENSE 檔案。

## 相關連結

- [Package Dependencies](./package.json)
- [Security Policy](./SECURITY.md)
