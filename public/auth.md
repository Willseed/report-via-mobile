# auth.md — 台灣交通違規簡訊報案工具

台灣交通違規簡訊報案工具是公開的靜態 PWA。免費、開源的台灣交通違規簡訊報案工具，可查受理窗口、填表、產生草稿、預覽，並在使用者確認後打開系統簡訊 App。

本工具不會自動報案、不代寄簡訊，也不會在本站後端保存車牌或地址；本工具不是官方系統。

遠端 Agent 不能送出簡訊；只有使用者裝置上、開著本站的 Agent 能操表單。

## 公開使用

本服務沒有帳號系統、受保護 API、OAuth token 或託管 MCP transport。Agent 不需要註冊、登入、API key 或 Authorization header；請直接在使用者裝置開啟本站，讓相容瀏覽器提供 WebMCP 工具。

## anonymous / no credential

若 Agent 需要讀取授權探索文件，請先讀取：

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`

這兩份文件描述 anonymous 身分與 no credential。`register_uri` 是本文件的唯讀說明，不接受 POST，也不會核發憑證；`claim_uri` 只是文件錨點，不是 API。

## 使用限制

- 草稿尚未送出；開啟簡訊 App 前，使用者須在頁面確認受理單位、電話及完整本文。
- 遠端 Agent 不能送出簡訊；只有使用者裝置上、開著本站的 Agent 能操表單。
- 本站沒有報案資料後端，不會在本站伺服器保存車牌或地址。表單及短期反查快取只在目前頁面的記憶體中使用；新版不再以 Service Worker 持久快取定位反查資料，啟動時也會嘗試清除舊版快取。若使用者同意定位，瀏覽器會將座標送至 OpenStreetMap Nominatim；瀏覽器與該第三方服務可能依各自政策處理請求資料。可在瀏覽器設定中清除本站網站資料；Agent 不會暗開 GPS。
- 本站只提供瀏覽器 WebMCP 工具；沒有遠端 MCP server 或代寄簡訊服務。

## 公開文件

- [首頁](https://tools.pylot.dev/)
- [Markdown 首頁](https://tools.pylot.dev/index.md)
- [Agent Skill](https://tools.pylot.dev/.well-known/agent-skills/report-via-mobile/SKILL.md)
- [API catalog](https://tools.pylot.dev/.well-known/api-catalog)
- [MCP server-card](https://tools.pylot.dev/.well-known/mcp/server-card.json)
- [原始碼](https://github.com/Willseed/report-via-mobile)
