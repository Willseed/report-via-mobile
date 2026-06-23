---
name: angular-v22-docs
description: >
  Angular 及 Angular Material 官方文件驅動開發。使用時機：開發 Angular 元件、服務、指令、管線時；使用 Angular Material 元件或主題時；遇到 Angular API 不確定用法時；需要確認 v22 最新寫法或 breaking changes 時。主動更新時機：發現官方文件 URL 結構變更時更新 references/doc-sources.md；發現新的 v22 重要變更時更新 references/v22-key-changes.md。
---

# Angular v22 Docs-Driven Development - 官方文件驅動的 Angular 開發

## 概述

確保所有 Angular 及 Angular Material 開發都以**官方最新文件為依據**，而非依賴 AI 訓練資料中可能過時的知識。

沒有這個 Skill 時，AI 可能使用舊版 API（如 NgModule、非 Signals 寫法、已棄用的 Material 元件 API）。有了之後，AI 會主動查閱官方文件確認最新用法再寫程式。

---

## 核心原則

| 原則 | 說明 | 對比 |
|------|------|------|
| 文件先行 | 寫程式前先確認官方文件的最新用法，不憑記憶寫 code | 反例：直接寫 `MatDialogModule` → 範例：先查文件確認 v22 的 import 方式 |
| 版本敏感 | Angular 生態變動快，v22 仍持續演進 signals、zoneless 與現代模板語法 | 反例：用 `@NgModule` 包元件 → 範例：確認 standalone component 的最新 pattern |
| 原始碼為證 | 當文件不夠清楚時，查閱 GitHub source 作為補充 | 反例：猜測 API 行為 → 範例：查 source 確認實際行為 |

---

## 工作流程

### 何時必須查閱文件

1. **建立新元件/服務/指令** — 確認最新的 decorator 選項與 standalone 寫法
2. **使用 Angular Material 元件** — 確認 v22 的 import 路徑、API、以及是否有 breaking changes
3. **使用 Angular CDK** — 確認 CDK 功能的最新用法
4. **路由設定** — 確認最新的 Route 設定方式（functional guards、resolvers 等）
5. **表單處理** — 確認 Reactive Forms / Template-driven Forms 的最新 pattern
6. **HTTP 請求** — 確認 HttpClient 的最新用法（functional interceptors 等）
7. **Signal 相關** — 確認 signal()、computed()、effect() 的最新 API 與限制
8. **Zoneless / Render Hooks** — 確認是否可直接依賴 zoneless 預設、避免使用 ZoneJS 假設，並優先使用 afterNextRender / afterEveryRender 等官方 render hooks

### 如何查閱

使用 WebSearch 搜尋時，**務必包含版本資訊**：

```
搜尋範例：
✓ "Angular 22 standalone component official documentation site:angular.dev"
✓ "Angular Material 22 mat-table API site:material.angular.dev"
✓ "Angular 22 signal inputs site:angular.dev"
✓ "Angular 22 zoneless official documentation site:angular.dev"
✗ "Angular component tutorial"（沒版本、沒限定官方站）
```

### 官方文件來源（優先順序）

1. **angular.dev** — Angular 官方文件（v20+ 主站，Angular 22 以此為主）
2. **material.angular.dev** — Angular Material 官方文件
3. **github.com/angular/angular** — Angular 原始碼
4. **github.com/angular/components** — Angular Material 原始碼

> 詳細的文件 URL 結構見 `references/doc-sources.md`

---

## 具體範例

### 情境：需要使用 Material Dialog

**不正確做法**（憑記憶直接寫）：
```typescript
// ❌ 可能使用了過時的 API
import { MatDialogModule } from '@angular/material/dialog';
```

**正確做法**（先查文件）：
1. WebSearch: `"Angular Material 22 dialog API site:material.angular.dev"`
2. WebFetch 官方頁面確認最新 import 方式與 standalone 用法
3. 根據官方文件撰寫程式碼

### Angular 22 優先檢查清單

1. **Signals 優先**：狀態與模板綁定優先確認是否能以 signals 驅動，而不是依賴手動訂閱或舊式變更偵測技巧。
2. **Zoneless 相容**：Angular 22 應預設以 zoneless-first 心智模型檢查；先確認是否真的需要 `provideZoneChangeDetection` 或 ZoneJS，相反地應優先移除對 `NgZone.onStable`、`onMicrotaskEmpty` 等 API 的依賴。
3. **Render hooks 取代穩定事件**：若需求是等待畫面完成渲染，優先查官方 `afterNextRender` / `afterEveryRender`，避免使用舊的 zone 穩定性觀察流程。
4. **HTTP 設定採 functional APIs**：查 `provideHttpClient()` 與 `withInterceptors()`，預設使用 fetch backend；若看到 `withInterceptorsFromDi()`，需確認是否有相容性理由。
5. **測試與正式環境對齊**：查官方 testing 指南，優先使用 Angular CLI 內建的 Vitest/jsdom 流程，必要時於 TestBed 加入 `provideZonelessChangeDetection()` 以提高與正式環境的一致性。

---

## 何時更新這份 Skill

> **AI 主動更新規則**：以下情境發生時，AI 應主動提議更新。

| 情境 | 更新什麼 | 操作 |
|------|----------|------|
| 發現官方文件 URL 變更 | `references/doc-sources.md` | 修改 URL |
| 發現 v22 重要 breaking change | `references/v22-key-changes.md` | 追加記錄 |
| 查文件後發現 CLAUDE.md 架構描述過時 | 通知使用者更新 CLAUDE.md | 提議修改 |
| 發現新的最佳搜尋關鍵字模式 | 工作流程章節 | 追加範例 |

### 更新原則

1. **實證驅動**：只收錄經過查閱官方文件確認的資訊
2. **保留脈絡**：更新時標注「何時、因何事發現」
3. **精簡為上**：references 只記錄高價值的發現，不做文件搬運

---

## 參考資源

- **官方文件 URL 結構**：`references/doc-sources.md`
- **v22 重要變更記錄**：`references/v22-key-changes.md`
