# 安全性政策

## 支援版本

我們目前支援以下維護線的安全性更新：

| 版本 / 維護線                    | 是否支援           | 說明 |
| -------------------------------- | ------------------ | ---- |
| 1.x（`main`）                    | :white_check_mark: | 目前唯一受支援的維護線 |
| < 1.0                            | :x:                | 已終止支援 |
| 歷史快照、功能分支、私人 fork    | :x:                | 不提供安全性修補承諾 |

## 發布與版本策略

本專案採用[語意化版本（SemVer）](https://semver.org/)管理版本，安全性修補與其他顯著變更
記錄在根目錄的 `CHANGELOG.md` 並反映到對應的 GitHub Release。

## 回報安全漏洞

如果您在此專案中發現安全漏洞，請透過 GitHub 的私人安全性報告功能進行回報，以避免在修復前公開漏洞細節。

### 回報方式

1. 前往此專案的 [Security Advisories](https://github.com/Willseed/report-via-mobile/security/advisories) 頁面
2. 點選「Report a vulnerability」按鈕
3. 填寫漏洞詳細資訊，包括：
   - 受影響的元件或功能
   - 漏洞的嚴重程度
   - 重現步驟
   - 可能的影響範圍

### 回應時程

- **初步確認**：我們會在 **3 個工作天內**回覆您的報告
- **漏洞評估**：完成評估後會在 **7 個工作天內**告知是否接受此漏洞報告
- **修復計畫**：接受的漏洞會依照嚴重性優先處理，並提供預計修復時程
- **發布修復**：修復完成後會在 `CHANGELOG.md` 與 GitHub Security Advisories 中公告；
  若有正式 release，也會同步反映到對應版本資訊

### 其他聯絡方式

若無法使用 GitHub Security Advisories，您也可以透過 GitHub Issues 聯絡專案維護者 @Willseed，但請**不要**在 Issue 中公開漏洞細節。

感謝您協助保護此專案及其使用者的安全！
