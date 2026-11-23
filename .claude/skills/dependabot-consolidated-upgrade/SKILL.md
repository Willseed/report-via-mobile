---
name: dependabot-consolidated-upgrade
description: >
  彙總 Dependabot 套件升級 PR 並處理安全相關升級，一次升到位後開一個彙總 PR。使用時機：使用者要求「升級套件」「彙總 Dependabot PR」「處理漏洞升級」時；Dependabot 累積多個升級 PR 造成合併衝突時；需要確認 npm 漏洞狀態（Dependabot alerts / npm audit）時。本 skill 屬於 report-via-mobile 專案，反映其雙 manifest（根目錄 + .github/npm）與 Angular 生態版本鎖定特性。
---

# Dependabot 彙總升級 - 套件升級 PR 彙總與漏洞升級

## 概述

Dependabot 每週（週一 02:00 Asia/Taipei）為本專案開出多個獨立升級 PR（npm 上限 10 個、Actions 上限 5 個）。逐一合併既慢又容易互相衝突（Angular 各套件版本錯開時 `npm install` 會 eresolve 失敗）。本 skill 將整個流程標準化：**蒐集 → 彙總到最新版 → 驗證 → 開一個彙總 PR → 標記 supersedes**。

## 關鍵背景知識

### 專案特性
- **雙 npm manifest**：根目錄 `package.json` + `.github/npm/package.json`（npm 工具鏈專屬，由 `.github/scripts/install-npm-cli.mjs` 使用）。兩邊都要檢查 `npm audit`。
- **Actions 一律 SHA pin**：workflow 中 `uses:` 的格式是 `action@<full-sha> # vX.Y.Z`。升級時必須取 Dependabot 分支上的新 SHA，不可只改成 tag。
- **版本鎖定策略**：Angular 家族使用精確版本（`22.3.0` 無前綴）；其餘用 `^` / `~`。彙總升級時 Angular 家族 12 個套件（core、cdk、common、compiler、animations、forms、localize、material、platform-browser、router、service-worker、build、cli、compiler-cli）**必須同版**，否則 peer 解析衝突。
- **angular-eslint 與 @angular/* 版本獨立**：`angular-eslint` 家族（builder、eslint-plugin、eslint-plugin-template、template-parser、angular-eslint 5 個套件）版本號軌道不同（22.8.0 ≠ 22.3.0），分開查。
- **`overrides` 區塊**：`package.json` 有大量安全修補 overrides，與升級無關、不要動；npm install 後確認 audit 仍為 0。
- **Vitest + jsdom 測試**：`npm test`（ng test）；驗證務必用 `npx ng test`，直接跑 `npx vitest run` 不會載入 Angular 測試環境（會誤報 "Need to call TestBed.initTestEnvironment()"）。

### 常見版本耦合陷阱
| 套件 | 耦合關係 |
|------|----------|
| `stylelint-config-standard-scss` | peer 要求對應 major 的 `stylelint`（v18 ↔ stylelint ^18）。Dependabot 只會開 config 的 PR，**stylelint 必須同 PR 一起升**，否則 eresolve。 |
| `@angular/material` | peer 綁定明確的 `@angular/cdk` 版本（22.3.0 ↔ cdk 22.3.0），必須同升。 |
| `typescript-eslint` / `eslint` | peer 允許 ^8.57.0 \|\| ^9 \|\| ^10，可獨立升。 |
| `@playwright/test` 與 `playwright` | 兩個 devDeps 都存在，版本要保持一致。 |

### Angular 小版升級可能觸發的全域型別衝突
Angular 22.3 起在 `@angular/core` 內建 WebMCP 規格全域型別（`types/core.d.ts` → `third_party/webmcp-types`），對 `Document.modelContext` 做 `readonly modelContext?: WebMCP.ModelContext` 宣告。若專案端 `declare global` 重複宣告同名屬性，會出現 TS2687（modifiers 不同）與 TS2717（型別不同）。處理方式見以下升級步驟第 6 步。

## 工作流程

### 1. 盤點現況
```bash
# 同步 main、列出開放中的 Dependabot PR
git pull --ff-only origin main
gh pr list --json number,title,headRefName,state --search "author:app/dependabot"

# 檢查漏洞（無漏洞時略過漏洞段落）
gh api "repos/Willseed/report-via-mobile/dependabot/alerts?state=open" --jq 'length'
npm audit --omit=dev   # 根 manifest
npm audit              # 含 dev
cd .github/npm && npm audit   # 工具鏈 manifest
```

### 2. 取得每個 PR 的實際升級內容
```bash
gh pr diff <number> | grep -E '^diff|^ +'   # 看 package.json 精確的目標版本
```

### 3. 查詢最新版本，決定彙總目標
**原則：升到家族最新版而非 Dependabot 提的版本**（Dependabot 依 lockfile 當下計算，往往落後 registry 數個 patch），合併後舊 PR 自動失效。
```bash
npm view <pkg> version        # 各套件最新版
npm view <pkg>@<ver> peerDependencies   # 確認 peer 耦合
```

### 4. 建彙總分支
```bash
git checkout -b chore/deps-consolidated-upgrades-$(date +%Y%m%d)
```

### 5. 更新 package.json 後重裝
- Angular 家族統一改為最新版（精確版本）；其餘依 coupling 陷阱表同升。
- 若出現 eresolve：**先確認不是版本錯開造成**；若是殘留混合狀態，`rm -rf node_modules package-lock.json && npm install`。
- `package.json` 的 `overrides` 不可更動。

### 6. 掃描升級造成的型別破壞
```bash
npx ng test 2>&1 | head -60   # 先看 build 階段 TS 錯誤
```
若出現 TS2687/TS2717 且指向全域屬性宣告（如 `Document.modelContext`）：
- Angular 已內建該屬性 → 移除專案端對該 host（Document）的重複 `declare global` 宣告。
- Angular 未涵蓋的 host（如 `Navigator`）→ 保留宣告，型別改用 `WebMCP.ModelContext` 交錯補齊：
  ```typescript
  type RuntimeModelContext = WebMCP.ModelContext & { provideContext?(…): void };
  ```
- 執行期防禦（`isModelContext` 型別守衛）維持不變，行為不變、僅型別層調整。

### 7. 完整驗證（順序執行）
```bash
npm run lint          # ESLint
npm run lint:styles   # Stylelint（stylelint 升 major 後尤其重要）
npx ng test           # Vitest + jsdom（須為 0 失敗）
npm run build         # production build；budget 警告可接受、Error 不可
npm audit             # 三個 manifest 均需 0 vulnerabilities
```

### 8. Actions SHA pin 升級（若有 Dependabot Actions PR）
```bash
git fetch origin <dependabot-branch>:refs/remotes/origin/<dependabot-branch>
git show origin/<dependabot-branch>:<workflow-path> | grep "uses:"   # 取新 SHA + 註解版本
```
僅替換 workflow 中該行的 `uses:` 值（SHA 與註解版本同步更新）。

### 9. Commit、Push、開彙總 PR
- Commit message：`chore(deps): 彙總 Dependabot 套件升級並升級安全動作`，列出各家族版本變化與被取代的 PR 編號，結尾加 `Supersedes #660 ... #670`。
- PR body 用 `.github/pull_request_template.md` 原樣結構，Change type 勾 **Security or dependency update**，Validation 逐項附結果（指令 + 通過/失敗，不可只列指令），Related issue 註明 Supersedes 的 PR。
- 合併後 Dependabot 會自動關閉被取代的舊 PR；確認無殘留。

## 驗收標準
- 一個彙總 PR 覆蓋全部開放的 Dependabot PR。
- lint / lint:styles / ng test / build / npm audit 全綠。
- Actions 仍為 SHA pin 格式。
- 工作樹乾淨、無殘留 stash。
