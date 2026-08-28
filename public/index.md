# 簡訊報案工具

📅 更新日期：2026-08-24

快速整理交通違規簡訊報案內容，依目前地址或 GPS 反查結果帶出對應的警政受理單位，
協助使用者在手機上檢查資訊後開啟原生簡訊 App 送出。

## 主要功能

- 使用瀏覽器定位與 OpenStreetMap Nominatim 反查地址。
- 依臺灣縣市、行政區對應警察局或交通違規簡訊受理窗口。
- 選擇違規類型、輸入車牌與地點後產生可編輯的簡訊草稿。
- 保留使用者確認流程；此網站不會代替使用者自動送出簡訊。
- PWA App Shell 可離線開啟，定位與反查地址仍需可用的瀏覽器與網路能力。

## Agent discovery

- API catalog: `/.well-known/api-catalog`
- OAuth Protected Resource Metadata: `/.well-known/oauth-protected-resource`（宣告此公開靜態站不需要 OAuth）
- Agent skills index: `/.well-known/agent-skills/index.json`
- MCP server card: `/.well-known/mcp/server-card.json`（說明沒有託管 MCP transport）
- Authorization and data-use service document: `/auth.md`
- 支援的瀏覽器代理可透過 `navigator.modelContext` 取得用戶端 WebMCP 工具；這不是託管 MCP 伺服器。
- Web app manifest: `/manifest.webmanifest`
- Source and service documentation: `https://github.com/Willseed/report-via-mobile`

## 介面與限制

- 預設瀏覽器首頁仍是 HTML：`/`
- Markdown 版本固定提供於 `/index.md`
- Cloudflare Worker 部署後，首頁請求若明確偏好 `Accept: text/markdown`，會回傳本檔案。
- GitHub Pages 靜態託管本身無法設定自訂 Link response headers，也無法依 `Accept` 標頭做內容協商。
- 本網站沒有伺服器端 API、登入流程或授權伺服器，因此不提供 authorization-server metadata。
