# 台灣交通違規簡訊報案工具

免費、開源、mobile-first 的台灣交通違規簡訊報案輔助工具。依 GPS 或手動地址對應地區與警政受理單位，整理違規內容後交給手機簡訊 App；**最後仍由使用者確認並送出**，不會自動報案。

別名：簡訊報案工具、交通違規簡訊報案工具。

**立即使用：[tools.pylot.dev](https://tools.pylot.dev)** · **原始碼：[GitHub](https://github.com/Willseed/report-via-mobile)**

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/df9a6a592af94cb298384bede0f5ef7f)](https://app.codacy.com/gh/Willseed/report-via-mobile/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/Willseed/report-via-mobile/badge)](https://securityscorecards.dev/viewer/?uri=github.com/Willseed/report-via-mobile)
[![OpenSSF Baseline](https://www.bestpractices.dev/projects/11934/baseline)](https://www.bestpractices.dev/projects/11934)
![Build Status](https://github.com/Willseed/report-via-mobile/actions/workflows/ci.yml/badge.svg)
![CodeQL](https://github.com/Willseed/report-via-mobile/actions/workflows/codeql.yml/badge.svg)
![License](https://img.shields.io/github/license/Willseed/report-via-mobile)
![Dependabot](https://img.shields.io/badge/dependabot-enabled-blue?logo=dependabot)

流程：GPS／地址 → 地區 → 警政受理單位 → 違規內容 → 簡訊草稿（使用者自行送出）。

本工具沒有帳號系統，也不會把報案內容存到專案自有後端。定位座標僅在使用者同意後送至 OpenStreetMap Nominatim 反查地址。本工具與內政部警政署或各級警察局無官方隸屬關係。

## 可以用它做什麼？

- 透過 GPS 取得目前位置並轉換成地址，也可以直接手動輸入地址。
- 依行政區找出承辦警察機關與簡訊號碼；適用臺北、新北、桃園、臺中、臺南、高雄等臺灣縣市。
- 快速選擇違規情形，並視需要加入車牌號碼。
- 先預覽完整報案內容，再開啟手機的簡訊 App。
- 將網站安裝成 PWA，並在基本功能上支援離線使用。

## 使用方式

1. 輸入事發地址，或允許瀏覽器使用定位功能。
2. 確認工具自動帶入的行政區與警察機關。
3. 選擇違規情形；若知道車牌號碼，也可以一併填寫。
4. 檢查簡訊預覽內容。
5. 開啟手機簡訊 App，確認收件人與內容後自行送出。

> 本工具只負責產生簡訊草稿，不會在背景自動報案。實際內容與是否送出，均以手機
> 簡訊 App 中的最後確認為準。

## 隱私與資料流

本專案是靜態網站，沒有帳號系統或專案自有的後端 API。手動輸入的報案內容由瀏覽器
組合，之後透過 `sms:` 連結交給裝置的簡訊 App。

如果使用 GPS 定位，瀏覽器會先徵求定位權限，並將座標傳送至
[OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) 以取得地址。若不希望使用
定位服務，可以直接手動輸入地址。

## 給開發者

### 技術架構

- Angular 22：standalone components、signals、strict mode
- Angular Material 3
- Vitest + jsdom、Playwright
- OpenStreetMap Nominatim 反向地理編碼
- GitHub Pages 靜態網站與 Cloudflare Worker

更完整的系統組成、資料流與設計限制，請參閱
[架構文件](./docs/architecture.md)。

### 本機開發

需要 Node.js 24.x（與 CI 相同）及 npm 11.x。Angular 22 最低支援的 Node.js 版本為
20.19。

```bash
npm install
npm start
```

開啟 <http://localhost:4200/>。正式版建置輸出位於
`dist/report-via-mobile/browser/`。

### 品質檢查

| 指令 | 用途 |
| --- | --- |
| `npm test` | 執行單元測試 |
| `npm run test:coverage` | 執行單元測試並產生覆蓋率 |
| `npm run lint` | 檢查 TypeScript |
| `npm run lint:styles` | 檢查 SCSS |
| `npm run e2e` | 執行 Playwright 端對端測試 |
| `npm run build` | 建置正式版網站 |
| `npm run build:analyze` | 在本機分析 bundle，不改變部署設定 |
| `npm run quality` | 依序執行 lint、樣式檢查、覆蓋率與建置 |

## 參與專案

歡迎回報問題、改善文件或提交程式碼。開始前請先閱讀
[貢獻指南](./CONTRIBUTING.md)與[行為準則](./CODE_OF_CONDUCT.md)。新功能與錯誤修正原則上
應包含測試；若不適合自動化測試，請在 pull request 中說明原因。

合併至 `main` 前，pull request 必須通過必要檢查並取得核准。維護者也應依
`CODEOWNERS` 政策確認適當的審查者，即使目前分支規則未強制要求
`require_code_owner_reviews`。

## 安全、治理與專案透明度

本專案保留可公開檢查的安全政策、治理方式與開發證據，以符合 OpenSSF Baseline
與安全開源專案的實務要求。

| 資訊 | 文件 |
| --- | --- |
| 安全漏洞私下回報方式與支援版本 | [SECURITY.md](./SECURITY.md) |
| 貢獻流程與程式碼審查要求 | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| 專案角色與決策方式 | [GOVERNANCE.md](./GOVERNANCE.md) |
| 社群行為準則 | [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) |
| 安全需求與非目標 | [docs/security-requirements.md](./docs/security-requirements.md) |
| 威脅模型、緩解措施與證據 | [docs/assurance-case.md](./docs/assurance-case.md) |
| 未來 12 個月規劃 | [docs/roadmap.md](./docs/roadmap.md) |
| 系統架構與信任邊界 | [docs/architecture.md](./docs/architecture.md) |

**請勿在公開 issue 中揭露安全漏洞。** 請依
[安全政策](./SECURITY.md)提供的私人管道回報。

目前版本為 **1.0.0**，發布日期為 **2026-03-13**。

## 部署與進階探索設定

網站會在 `main` 通過 GitHub Actions 後，自動建置並部署至 GitHub Pages。
「更新日期」只在維護者合併 pull request 時一併更新（`src/index.html`、
`public/index.md`、`src/app/i18n/zh-TW.ts`），部署完成後不會再開 Bot PR。
由於 GitHub Pages 只能提供靜態檔案，部分 HTTP 回應標頭與內容協商由 Cloudflare Worker 補足。

<details>
<summary>給維護者：AI／代理程式探索資源與 HTTP Link 設定</summary>

專案提供以下靜態探索資源：

- `/llms.txt`：給大型語言模型與代理程式的精簡產品說明與文件連結。
- `/index.md`：供代理程式與純文字客戶端閱讀的 Markdown 首頁。
- `/.well-known/api-catalog`：公開資源的機器可讀目錄。
- `/.well-known/ai-catalog.json`：供 ARD／AI Catalog registry 索引的能力清單與代表查詢。
- `/.well-known/ard.json`：目前 ARD 規格使用的同內容 discovery alias。
- `/.well-known/oauth-protected-resource`：公開資源的 OAuth Protected Resource Metadata。
- `/.well-known/oauth-authorization-server`：包含 anonymous/no-credential `agent_auth` registration profile 的 OAuth metadata。
- `/.well-known/agent-skills/index.json`：機器可讀的使用者能力摘要。
- `/.well-known/mcp/server-card.json`：宣告本專案沒有託管 MCP transport 的 server card。
- `/auth.md`：授權與資料使用限制說明。

相容的瀏覽器代理程式也可能透過 `navigator.modelContext` 取得 client-side WebMCP
工具；這些工具不構成託管 MCP server 或受保護 API。`src/index.html` 提供供客戶端探索
的 HTML tags。`public/_headers` 會複製到建置輸出，可供 Cloudflare Pages、Netlify 等
支援該慣例的主機使用；GitHub Pages 只會將它當成靜態檔案。

`worker/link-headers.mjs` 由 `wrangler.toml` 設定於 `tools.pylot.dev/*`，負責附加首頁的
RFC 8288 `Link` 回應標頭。當首頁請求明確偏好 `Accept: text/markdown` 時，它會提供
`/index.md`；若靜態來源沒有公開 dot-directory assets，也會直接提供 ARD manifests、
`/.well-known/oauth-protected-resource` 與 `/.well-known/oauth-authorization-server` 作為 edge
fallback。兩份 ARD manifests 使用 `Access-Control-Allow-Origin: *`，允許公開 registry
跨來源索引。

首頁的 `Link` 回應包含：

- `rel="ai-catalog"` → `/.well-known/ai-catalog.json`
- `rel="ard"` → `/.well-known/ard.json`
- `rel="api-catalog"` → `/.well-known/api-catalog`
- `rel="describedby"` → `/.well-known/oauth-protected-resource`
- `rel="service-desc"` → `/.well-known/oauth-authorization-server`
- `rel="service-desc"` → `/.well-known/agent-skills/index.json`
- `rel="service-desc"` → `/.well-known/mcp/server-card.json`
- `rel="alternate service-doc"` → `/index.md`
- `rel="alternate"` → `/llms.txt`
- `rel="manifest"` → `/manifest.webmanifest`
- `rel="service-doc"` → `/auth.md`
- `rel="service-doc"` → GitHub repository documentation

本專案沒有受保護的 server-side API、登入流程或 token 發行服務。PRM 宣告公開的
`public` scope，並指向同源的 authorization-server metadata；其中 `agent_auth` 只描述
anonymous/no-credential 的公開使用方式，不會核發 OAuth token、API key 或其他 bearer credential。

Cloudflare Worker 需透過 **Deploy Cloudflare Worker** workflow 手動部署，並在
repository secrets 中設定 `CLOUDFLARE_ACCOUNT_ID` 與 `CLOUDFLARE_API_TOKEN`。

</details>

<details>
<summary>給維護者：DNS for AI Discovery（DNS-AID）</summary>

可部署的 origin 是 `tools.pylot.dev`（參考 `public/CNAME`、`wrangler.toml` 與
`src/index.html`）。此 repository 包含 GitHub Pages 與 Cloudflare Worker 設定，但沒有
`pylot.dev` zone 的 authoritative DNS-as-code；以下記錄必須在 DNS provider 或 zone
repository 發布，部署 App 本身不會建立記錄。

相關探索資源：

- `https://tools.pylot.dev/.well-known/api-catalog`
- `https://tools.pylot.dev/.well-known/ai-catalog.json`
- `https://tools.pylot.dev/.well-known/ard.json`
- `https://tools.pylot.dev/.well-known/agent-skills/index.json`

為組織索引發布一筆經 DNSSEC 簽署的 ServiceMode SVCB record：

```dns
_index._agents.tools.pylot.dev. 3600 IN SVCB 1 tools.pylot.dev. (
  alpn=h2
  port=443
  endpoint="/.well-known/api-catalog"
  well-known="api-catalog"
)
```

`endpoint` 會解析至上述 API catalog，並由它連至 agent skills index。

如果 DNS provider 只提供相容 SVCB 的 `HTTPS` RR type，請以 `HTTPS` record 輸入相同
owner name 與 RDATA；除非 DNS-AID 最終草案要求，否則不要同時發布 SVCB 與 HTTPS。
請保持 `pylot.dev` 的 DNSSEC 啟用，並在 registrar 發布 DS record。若未來加入
DANE/TLSA records，它們也必須經 DNSSEC 簽署。

目前不要發布 `_a2a._agents.tools.pylot.dev`：本專案尚未實作 Agent-to-Agent server
endpoint。實作後再加入獨立的 ServiceMode record，設定 `alpn=a2a,h2` 並將 `endpoint`
指向真正存在的 endpoint。

</details>

## 授權

本專案採用 MIT License，詳見 [LICENSE](./LICENSE)。
