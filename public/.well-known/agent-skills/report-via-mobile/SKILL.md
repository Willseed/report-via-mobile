---
name: report-via-mobile
description: 台灣交通違規簡訊報案工具的瀏覽器 WebMCP 操作說明；只協助使用者查窗口、填表、產生與預覽簡訊草稿。
---

# 台灣交通違規簡訊報案工具 Agent Skill

免費、開源的台灣交通違規簡訊報案工具，可查受理窗口、填表、產生草稿、預覽，並在使用者確認後打開系統簡訊 App。

本工具不會自動報案、不代寄簡訊、不存車牌／地址，也不是官方系統。

遠端 Agent 不能送出簡訊；只有使用者裝置上、開著本站的 Agent 能操表單。

## 使用流程

1. 在使用者裝置開啟 https://tools.pylot.dev/；遠端 Agent 不能操作本站表單或送出簡訊。
2. 使用 `list_violation_types` 取得現有違規選項。
3. 使用 `lookup_station` 依地址、行政區或使用者已授權提供的座標查受理窗口與號碼。工具不會暗開 GPS。
4. 使用 `set_report_form` 將使用者確認的資料寫入表單；這一步只改表單。
5. 使用 `preview_sms` 讀取表單並檢查完整草稿、收件人、受理單位與警告。預覽內容尚未送出；warnings 必含 `尚未送出`、`非官方`、`需使用者確認`。
6. 只有使用者手勢或頁內明確確認後，才可使用 `open_sms_composer` 打開系統簡訊 App；是否送出仍由使用者在 App 內決定。

## 瀏覽器工具

### `list_violation_types`

Does not submit a police report. 列出本站目前的交通違規選項與輸入限制。

### `lookup_station`

Does not submit a police report. 依地址、行政區或使用者已授權提供的座標查詢行政區、受理單位與簡訊號碼；不會自行要求定位權限。

### `set_report_form`

Does not submit a police report. 只把地址、行政區、違規事實與車牌寫入本站表單，不會開啟簡訊 App。

### `preview_sms`

Does not submit a police report. 讀取本站表單並產生收件人、簡訊本文、受理單位與確認警告；不會送出。

### `open_sms_composer`

Does not submit a police report. 只有使用者手勢或頁內明確確認後，才在使用者裝置上打開系統簡訊 App；沒有確認只回傳 opened:false。

## 限制

- 這 5 個工具只在已開啟本站的使用者裝置瀏覽器中，透過 navigator.modelContext 提供。
- 工具只使用本站前端狀態與內建受理窗口資料，不呼叫本站自有後端，也沒有遠端代操作介面。
- lookup_station 不會暗開 GPS；座標必須由使用者授權的定位流程提供，或由使用者明確傳入。
- set_report_form 只改表單；preview_sms 只產生草稿，草稿尚未送出。
- open_sms_composer 需要使用者手勢或頁內明確確認；遠端 Agent 不能送出簡訊。

工具只使用本站前端狀態與內建受理窗口資料，不會呼叫本站自有後端。不得註冊或宣稱存在 `send_sms`、`submit_report`、遠端 MCP tools 或代寄簡訊 API。
