# 變更紀錄

此檔案用來記錄專案的重要變更。本專案採用[語意化版本（SemVer）](https://semver.org/)管理版本。

## [Unreleased]

## [1.0.0] - 2026-03-13

### 新增

- 建立正式 release 的版本基線與變更紀錄。
- 主要 Build/Test workflow 現在會強制執行 `npm run lint` 與 `npm run lint:styles`。
- 生產建置完成後會正規化 Angular Service Worker 的 `ngsw.json`，優先使用
  `SOURCE_DATE_EPOCH`，否則使用對相同 commit／來源內容穩定的 fallback。
- 首個正式版本發佈：行動裝置交通違規 SMS 檢舉功能。

### 變更

- `build-and-test` workflow 會在 production build 前匯出 `SOURCE_DATE_EPOCH`，並透過
  `npm run build -- --configuration production` 觸發可重現的後處理流程。
- 安全性政策現在明確說明目前支援的維護線、回應時程與揭露方式。
