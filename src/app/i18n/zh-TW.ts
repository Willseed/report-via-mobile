export const ZH_TW = {
  // Geocoding Service
  geocoding: {
    invalidCoordinates: '無效的座標資訊。',
    defaultError: '定位失敗，請稍後再試。',
    browserNotSupported: '您的瀏覽器不支援定位功能。',
    permissionDenied: '定位權限被拒絕，請允許存取位置資訊。',
    positionUnavailable: '無法取得位置資訊。',
    timeout: '定位逾時，請稍後再試。',
    queryFailed: '地址查詢失敗，請稍後再試。',
    parseError: '無法解析地址，請手動輸入。',
    rateLimited: '地址查詢服務繁忙，請稍候再試或手動輸入地址。',
    serviceUnavailable: '地址查詢服務暫時無法使用，請手動輸入地址。',
    circuitOpen: '地址查詢服務暫時停用，請手動輸入地址。',
  },

  // Location Input
  location: {
    addressRequired: '請輸入事發地址。',
    addressMaxLength: '地址不可超過 100 字。',
    addressHint: '輸入地址或按右側按鈕定位，將自動帶入行政區。',
    districtLabel: '報案行政區',
    districtRequired: '請選擇報案行政區。',
    stationPrefix: '承辦單位：',
    addressLabel: '事發地址',
    addressPlaceholder: '請輸入地址...',
    locateButtonLabel: '使用目前位置',
    locateSuccess: '已定位：',
    fallbackHint: '自動定位暫時無法使用，請手動輸入地址與選擇行政區。',
    offlineHint: '目前為離線狀態，無法使用定位功能。',
  },

  // Violation Input
  violation: {
    label: '違規事實',
    placeholder: '請選擇違規事實...',
    required: '請選擇違規事實。',
    maxLength: '違規事實不可超過 50 字。',
    licensePlateLabel: '車牌號碼（選填）',
    licensePlatePlaceholder: '例：ABC1234',
    licensePlateMaxLength: '車牌號碼不可超過 10 字。',
    licensePlatePattern: '車牌號碼僅限英文及數字。',
    licensePlateHint: '僅限英文及數字，英文將自動轉為大寫。',
    addLicensePlate: '新增車牌號碼',
    removeLicensePlateLabel: '移除車牌號碼',
  },

  // SMS Form
  smsForm: {
    title: '簡訊報案',
    subtitle: '填寫以下表單，透過您裝置的簡訊功能傳送報案訊息。',
    lastUpdated: '📅 更新日期：2026-08-28',
    desktopWarning: '簡訊連結可能無法在桌面瀏覽器上使用，請用行動裝置掃描',
    desktopLinkLabel: 'https://tools.pylot.dev/',
    desktopLinkAriaLabel: '開啟 https://tools.pylot.dev/；停留或聚焦可顯示 QR Code',
    desktopQrHint: '以手機掃描 QR Code 開啟網站',
    desktopQrAlt: 'https://tools.pylot.dev/ 的 QR Code',
    freeNotice: '發送此簡訊是免費的。',
    pendingPreviewHint: '待選擇行政區後顯示簡訊預覽…',
    districtMismatchWarning: '輸入地址與報案行政區不一致，請確認後再發送。',
    legalNotice: '報案的受理與否，最終由該轄區警察局依法審核決定。',
    sendButton: '發送簡訊',
    iosLengthWarning: 'iOS 裝置建議簡訊少於 1600 字，請精簡內容後再發送。',
    onpageContent: {
      title: '交通違規簡訊報案使用說明',
      howToUseTitle: '如何使用本工具',
      howToUseSteps: [
        '輸入事發地址，或使用手機定位自動帶入行政區。',
        '選擇違規事實；若有車牌，可一併填寫。',
        '確認簡訊預覽與收件資訊後，按「發送簡訊」開啟簡訊 App。',
      ],
      scenariosTitle: '適用檢舉情境',
      scenarios: [
        '紅線、黃線、人行道或行人穿越道違規停車、臨停。',
        '佔用身心障礙者專用停車位等常見道路交通違規。',
        '可用簡訊提供明確地點、違規事實與車牌資訊的案件。',
      ],
      checklistTitle: '送出前檢查',
      checklist: [
        '地址與報案行政區一致，必要時手動修正。',
        '違規事實描述清楚，車牌號碼已確認無誤。',
        '手機簡訊畫面中的收件單位與內容已再次核對。',
      ],
      caveatsTitle: '受理與法律提醒',
      caveats: [
        '本工具只協助產生簡訊內容，不代表檢舉一定成立或受理。',
        '案件是否受理、舉發與裁處，仍由轄區警察機關依法判斷。',
        '請勿捏造事實或提供不實資料；送出前請自行確認內容。',
      ],
      coverageTitle: '支援地區與適用情境',
      coverage: [
        '本工具適用臺灣各縣市的交通違規簡訊報案，包含臺北市、新北市、桃園市、臺中市、臺南市與高雄市等主要都會區，也涵蓋其他縣市的警政簡訊受理窗口。',
        '若你在臺北或新北遇到紅線違停、在桃園或臺中需要對應警察局簡訊號碼，或在臺南、高雄想先預覽檢舉簡訊，都可以先整理地點、違規事實與車牌，再開啟手機簡訊 App。',
      ],
      faqTitle: '常見問題',
      faq: [
        {
          question: '如何用簡訊報案交通違規？',
          answer:
            '在台灣交通違規簡訊報案工具輸入事發地址或使用 GPS 定位，確認行政區與警政受理單位後，選擇違規事實並預覽簡訊。確認無誤再開啟手機簡訊 App，由你自行送出。',
        },
        {
          question: '可以用來檢舉違規停車嗎？',
          answer:
            '可以。紅線、黃線、人行道或行人穿越道違規停車、臨停，以及佔用身心障礙者專用停車位等常見交通違規，只要能提供明確地點與事實，都適合用簡訊整理報案內容。',
        },
        {
          question: '一定要用 GPS 嗎？可以只輸入地址嗎？',
          answer:
            '不必一定使用 GPS。你可以允許瀏覽器定位，也可以直接手動輸入地址並選擇報案行政區。不想授權定位時，建議改走手動輸入。',
        },
        {
          question: '警政受理單位是怎麼對應的？',
          answer:
            '工具會依地址所在縣市或你選擇的報案行政區，帶入對應警察局的簡訊受理窗口。送出前請再核對收件單位與號碼是否正確。',
        },
        {
          question: '這個網站會自動幫我報案嗎？',
          answer:
            '不會。本工具只產生簡訊草稿並交給手機簡訊 App，最後仍由你確認收件人與內容後才送出，不會在背景自動報案。',
        },
        {
          question: '使用時會把個資存到這個網站嗎？',
          answer:
            '這是靜態網站，沒有帳號系統或專案自有後端。手動輸入的內容在瀏覽器組合後交給簡訊 App。若使用 GPS，座標會在你同意後送至 OpenStreetMap Nominatim 反查地址。',
        },
        {
          question: '這是警政署或警察局的官方網站嗎？',
          answer:
            '不是。本工具與內政部警政署或各級警察局無官方隸屬關係。案件是否受理、舉發與裁處，仍由轄區警察機關依法判斷。',
        },
      ],
    },
    disclaimerTitle: '免責聲明',
    disclaimerP1: '檢舉是否受理及後續罰鍰裁處，悉依警察機關及相關交通法規辦理；本工具與內政部警政署或各級警察局無官方隸屬關係。',
    disclaimerP2: '免責事項：本工具僅供輔助生成交通違規檢舉簡訊內容，不代表檢舉成功之保證；使用者送出前應自行核對違規時間、地點及事實之正確性。若因輸入資料錯誤致生法律糾紛或行政處分，本站概不負責。',
    chunkLoadError: '載入元件失敗，請檢查網路連線後再試。',
  },

  // SMS Preview
  smsPreview: {
    header: '簡訊預覽',
    charSuffix: '字',
    overLimitWarning: '簡訊內容超過 {limit} 字，可能被拆為多則傳送。',
  },

  // Confirm Dialog
  confirmDialog: {
    title: '確認發送簡訊',
    recipientLabel: '收件單位',
    phoneLabel: '簡訊號碼',
    licensePlateLabel: '車牌號碼',
    messageLabel: '簡訊內容',
    cancelButton: '取消',
    confirmButton: '確認發送',
  },

  // SMS Message Template
  smsMessage: {
    template: '{address}，有{violation}{plateSegment}，請派員處理',
    platePrefix: '，車牌號碼：',
  },

  // WebMCP browser tools
  webmcp: {
    listViolationTypesDescription: '列出本站支援的交通違規事實選項與輸入限制。',
    lookupPoliceStationDescription: '依事發地址或報案行政區查詢對應警察機關資料。',
    generateSmsReportDescription: '依事發地址、違規事實、車牌與行政區資料產生簡訊報案內容與連結。',
    addressDescription: '事發地址。',
    violationDescription: '違規事實。',
    licensePlateDescription: '車牌號碼，僅限英文與數字，可省略。',
    districtDescription: '報案行政區；若提供，會優先使用此行政區的承辦單位。',
    missingAddress: '請提供事發地址。',
    missingViolation: '請提供違規事實。',
    missingLookupInput: '請提供事發地址或報案行政區。',
    invalidDistrict: '不支援的報案行政區。',
    stationNotFound: '找不到對應警察機關。',
    addressTooLong: '地址不可超過 100 字。',
    violationTooLong: '違規事實不可超過 50 字。',
    licensePlateTooLong: '車牌號碼不可超過 10 字。',
  },

  // Theme Toggle
  theme: {
    switchToLight: '切換為淺色模式',
    switchToDark: '切換為深色模式',
  },

  // PWA Services
  pwa: {
    updateAvailable: '有新版本可用',
    updateAction: '更新',
    updateFailed: '更新失敗，請重新整理頁面',
    unrecoverableError: '應用程式發生錯誤，將重新載入',
    installPrompt: '可將此應用安裝至主畫面',
    installAction: '安裝',
  },
} as const;

export type Locale = typeof ZH_TW;
