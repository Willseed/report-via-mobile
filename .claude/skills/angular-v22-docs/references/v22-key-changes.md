# Angular v22 重要變更記錄

> 開發過程中查閱官方文件後確認的 v22 重要變更。每次發現新的 breaking change 或重要變更時追加。

## 記錄格式

```
### [變更主題]
- **發現日期**：YYYY-MM-DD
- **來源**：[官方文件 URL]
- **內容**：[變更說明]
- **影響**：[對本專案的影響]
```

---

### [Zoneless 已是預設模式，ZoneJS 應視為可移除相依]
- **發現日期**：2026-06-23
- **來源**：<https://angular.dev/guide/zoneless>
- **內容**：Angular 22 依循 v21+ 的 zoneless 預設路線。官方指南明確建議 zoneless 應移除 `zone.js` / `zone.js/testing`，並避免依賴 `NgZone.onMicrotaskEmpty`、`NgZone.onStable`、`NgZone.isStable` 等穩定性 API。
- **影響**：評估既有程式時，應優先確認是否仍有 ZoneJS 假設；若只是等待畫面渲染，應優先改查 `afterNextRender` / `afterEveryRender` 等 render hooks。

### [HttpClient 官方建議優先使用 functional interceptors]
- **發現日期**：2026-06-23
- **來源**：<https://angular.dev/guide/http/setup>、<https://angular.dev/guide/http/interceptors>
- **內容**：Angular 官方在 HttpClient 設定中推薦使用 `provideHttpClient()` 搭配 `withInterceptors()` 的 functional interceptors。`withInterceptorsFromDi()` 屬於較舊的 DI-based 攔截器相容方式。
- **影響**：新增或重構 HTTP 管線時，應先查 functional interceptor 寫法與順序，再決定是否保留 class-based interceptors。

### [Angular CLI 測試預設已是 Vitest + jsdom]
- **發現日期**：2026-06-23
- **來源**：<https://angular.dev/guide/testing>
- **內容**：官方 testing 指南說明 Angular CLI 新專案預設使用 Vitest 與 jsdom，並可透過 `providersFile` 將全域測試 providers 與正式環境對齊。
- **影響**：檢視測試實作時，不應再以 Karma/Jasmine 為預設假設；若專案採 zoneless，應考慮在測試環境同步配置 `provideZonelessChangeDetection()`。
