# Report via Mobile

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Willseed/report-via-mobile/badge)](https://securityscorecards.dev/viewer/?uri=github.com/Willseed/report-via-mobile)

行動裝置簡訊報案應用程式。使用者填寫事發地址、選擇行政區與違規事實後，自動組合簡訊內容並透過裝置原生簡訊功能（`sms:` URI scheme）發送至對應警局。

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
- **Styling:** SCSS
- **Routing:** HashLocationStrategy (GitHub Pages compatible)
- **Testing:** Vitest + jsdom
- **Hosting:** GitHub Pages (static)

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
