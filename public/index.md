# 台灣交通違規簡訊報案工具

📅 更新日期：2026-08-28

免費、開源、mobile-first 的台灣交通違規簡訊報案輔助工具。依 GPS 或手動地址對應地區與警政受理單位，整理違規內容後交給手機簡訊 App；最後仍由使用者確認並送出，不會自動報案。

別名：簡訊報案工具、交通違規簡訊報案工具。

## 主要功能

- 使用瀏覽器定位與 OpenStreetMap Nominatim 反查地址；也可只手動輸入地址。
- 依臺灣縣市、行政區對應警察局或交通違規簡訊受理窗口，包含臺北、新北、桃園、臺中、臺南、高雄等地區。
- 選擇違規類型、輸入車牌與地點後產生可編輯的簡訊草稿。
- 保留使用者確認流程；此網站不會代替使用者自動送出簡訊。
- 本站沒有帳號系統或專案自有後端；與內政部警政署或各級警察局無官方隸屬關係。
- PWA App Shell 可離線開啟，定位與反查地址仍需可用的瀏覽器與網路能力。

## Agent discovery

- llms.txt: `/llms.txt`
- API catalog: `/.well-known/api-catalog`
- ARD capability manifest: `/.well-known/ai-catalog.json`
- Current ARD manifest alias: `/.well-known/ard.json`
- OAuth Protected Resource Metadata: `/.well-known/oauth-protected-resource`
- OAuth Authorization Server Metadata: `/.well-known/oauth-authorization-server`（包含 `agent_auth` registration profile）
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
- ARD manifests 以公開 CORS 回應，並透過 HTML links、HTTP `Link` 與 `robots.txt` 的
  `Agentmap` 宣告供代理與 registry 探索。
- GitHub Pages 靜態託管本身無法設定自訂 Link response headers，也無法依 `Accept` 標頭做內容協商。
- 本網站沒有受保護的伺服器端 API、登入流程或 token 發行服務；authorization-server metadata
  僅用於公開 anonymous/no-credential 的 agent registration discovery。
