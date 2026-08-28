# 台灣交通違規簡訊報案工具

📅 更新日期：2026-08-28

免費、開源的台灣交通違規簡訊報案工具，可查受理窗口、填表、產生草稿、預覽，並在使用者確認後打開系統簡訊 App。

本工具不會自動報案、不代寄簡訊、不存車牌／地址，也不是官方系統。

遠端 Agent 不能送出簡訊；只有使用者裝置上、開著本站的 Agent 能操表單。

## 可以做什麼

- 查受理窗口。
- 填表。
- 產生草稿。
- 預覽。
- 打開系統簡訊 App。

## 不做什麼

- 不自動報案。
- 不代寄簡訊。
- 不存車牌／地址。
- 不是官方系統。

本站沒有自有後端，不會儲存車牌或地址。若使用者同意定位，瀏覽器會將座標送至 OpenStreetMap Nominatim 反查地址；Agent 不會暗開 GPS。

支援臺灣各縣市的警政簡訊受理窗口，包含臺北市、新北市、桃園市、臺中市、臺南市與高雄市等地區。

## 瀏覽器 WebMCP

這 5 個工具只在已開啟本站的使用者裝置瀏覽器中，透過 navigator.modelContext 提供。

工具只使用本站前端狀態與內建受理窗口資料，不呼叫本站自有後端，也沒有遠端代操作介面。

lookup_station 不會暗開 GPS；座標必須由使用者授權的定位流程提供，或由使用者明確傳入。

set_report_form 只改表單；preview_sms 只產生草稿，草稿尚未送出。

open_sms_composer 需要使用者手勢或頁內明確確認；遠端 Agent 不能送出簡訊。

工具名稱與用途：

- `list_violation_types`：Does not submit a police report. 列出本站目前的交通違規選項與輸入限制。
- `lookup_station`：Does not submit a police report. 依地址、行政區或使用者已授權提供的座標查詢行政區、受理單位與簡訊號碼；不會自行要求定位權限。
- `set_report_form`：Does not submit a police report. 只把地址、行政區、違規事實與車牌寫入本站表單，不會開啟簡訊 App。
- `preview_sms`：Does not submit a police report. 讀取本站表單並產生收件人、簡訊本文、受理單位與確認警告；不會送出。
- `open_sms_composer`：Does not submit a police report. 只有使用者手勢或頁內明確確認後，才在使用者裝置上打開系統簡訊 App；沒有確認只回傳 opened:false。

工具只會在使用者裝置上操作已開啟的本站表單。遠端 Agent 不能送出簡訊；本站沒有託管 MCP transport，也沒有代寄簡訊的遠端 API。

## Agent discovery

- [HTML 首頁](https://tools.pylot.dev/)：給人使用的 PWA 表單。
- [Markdown 首頁](https://tools.pylot.dev/index.md)：本文件，供 Agent 與純文字客戶端閱讀。
- [llms.txt](https://tools.pylot.dev/llms.txt)：給語言模型與 Agent 的精簡說明。
- [Agent Skill](https://tools.pylot.dev/.well-known/agent-skills/report-via-mobile/SKILL.md)：瀏覽器 WebMCP 工具與使用限制。
- [API catalog](https://tools.pylot.dev/.well-known/api-catalog)：公開文件與發現資源目錄。
- [MCP server-card](https://tools.pylot.dev/.well-known/mcp/server-card.json)：宣告沒有託管 MCP transport。
- [授權與資料使用](https://tools.pylot.dev/auth.md)：anonymous/no-credential 的公開使用說明。
- [原始碼](https://github.com/Willseed/report-via-mobile)：公開專案原始碼。

## 常見問題

### 這個工具可以做什麼？

台灣交通違規簡訊報案工具可以查受理窗口、填表、產生草稿、預覽，並在使用者確認後打開系統簡訊 App。

### 可以用來處理哪些交通違規？

本站提供現有交通違規選項，例如紅線、黃線、人行道或行人穿越道違規停車、臨停，以及佔用身心障礙者專用停車位等；也可填寫自訂的違規事實。

### 一定要用 GPS 嗎？

不必。你可以直接輸入地址並選擇行政區；只有在使用者允許時才使用定位，本站與 Agent 都不會暗開 GPS。

### 受理窗口怎麼對應？

工具依地址、行政區或使用者提供的定位座標，對應本站內建的行政區、警政受理單位與簡訊號碼；使用者仍應在簡訊 App 再次核對。

### 這個網站會自動幫我報案嗎？

不會自動報案，也不代寄簡訊。預覽內容尚未送出；只有使用者在裝置的系統簡訊 App 確認後，才可能由使用者自行決定是否送出。

### 本站會儲存車牌或地址嗎？

不會。本站沒有自有後端，不會儲存車牌或地址；定位反查時，瀏覽器只會在使用者同意後將座標送至 OpenStreetMap Nominatim。

### 這是警政署或警察局的官方網站嗎？

不是。本工具不是警政機關官方系統，與內政部警政署或各級警察局沒有官方隸屬關係。

### 遠端 Agent 可以替我送出簡訊嗎？

不能。只有使用者裝置上、開著本站的 Agent 能透過瀏覽器 WebMCP 操作表單；打開系統簡訊 App 前仍需要使用者手勢或頁內明確確認。
