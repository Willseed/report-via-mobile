import siteCopy from '../../../site-copy.json';

const [
  LIST_VIOLATION_TYPES_TOOL,
  LOOKUP_STATION_TOOL,
  SET_REPORT_FORM_TOOL,
  PREVIEW_SMS_TOOL,
  OPEN_SMS_COMPOSER_TOOL,
] = siteCopy.webmcpTools;

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
    title: siteCopy.app.formTitle,
    subtitle: siteCopy.app.subtitle,
    lastUpdated: `📅 更新日期：${siteCopy.updated}`,
    desktopWarning: siteCopy.app.desktopWarning,
    desktopLinkLabel: siteCopy.app.desktopLinkLabel,
    desktopLinkAriaLabel: siteCopy.app.desktopLinkAriaLabel,
    desktopQrHint: siteCopy.app.desktopQrHint,
    desktopQrAlt: siteCopy.app.desktopQrAlt,
    freeNotice: siteCopy.app.freeNotice,
    pendingPreviewHint: siteCopy.app.pendingPreviewHint,
    districtMismatchWarning: siteCopy.app.districtMismatchWarning,
    legalNotice: siteCopy.app.legalNotice,
    sendButton: siteCopy.app.sendButton,
    iosLengthWarning: siteCopy.app.iosLengthWarning,
    onpageContent: {
      title: siteCopy.app.onpageContent.title,
      howToUseTitle: siteCopy.app.onpageContent.howToUseTitle,
      howToUseSteps: siteCopy.app.onpageContent.howToUseSteps,
      scenariosTitle: siteCopy.app.onpageContent.scenariosTitle,
      scenarios: siteCopy.app.onpageContent.scenarios,
      checklistTitle: siteCopy.app.onpageContent.checklistTitle,
      checklist: siteCopy.app.onpageContent.checklist,
      caveatsTitle: siteCopy.app.onpageContent.caveatsTitle,
      caveats: siteCopy.app.onpageContent.caveats,
      coverageTitle: siteCopy.app.onpageContent.coverageTitle,
      coverage: siteCopy.app.onpageContent.coverage,
      faqTitle: siteCopy.app.onpageContent.faqTitle,
      faq: siteCopy.faq,
    },
    disclaimerTitle: siteCopy.app.disclaimerTitle,
    disclaimerP1: siteCopy.app.disclaimerP1,
    disclaimerP2: siteCopy.app.disclaimerP2,
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
    listViolationTypesDescription: LIST_VIOLATION_TYPES_TOOL.description,
    lookupStationDescription: LOOKUP_STATION_TOOL.description,
    setReportFormDescription: SET_REPORT_FORM_TOOL.description,
    previewSmsDescription: PREVIEW_SMS_TOOL.description,
    openSmsComposerDescription: OPEN_SMS_COMPOSER_TOOL.description,
    addressDescription: '事發地址。',
    violationDescription: '違規事實。',
    licensePlateDescription: '車牌號碼，僅限英文與數字，可省略。',
    platesDescription: '車牌號碼陣列；每個車牌僅限英文與數字，可省略。',
    districtDescription: '報案行政區；若提供，會優先使用此行政區的承辦單位。',
    latitudeDescription: '使用者已授權提供的緯度；工具不會自行取得定位。',
    longitudeDescription: '使用者已授權提供的經度；工具不會自行取得定位。',
    missingAddress: '請提供事發地址。',
    missingViolation: '請提供違規事實。',
    missingLookupInput: '請提供事發地址、報案行政區或成對的定位座標。',
    invalidDistrict: '不支援的報案行政區。',
    invalidCoordinates: '請提供有效且成對的定位座標；工具不會暗開 GPS。',
    coordinateLookupFailed: '無法依提供的定位座標查詢地址，請改用地址或行政區。',
    stationNotFound: '找不到對應警政受理窗口。',
    missingStation: '請先設定可對應的行政區或受理窗口。',
    addressTooLong: '地址不可超過 100 字。',
    violationTooLong: '違規事實不可超過 50 字。',
    licensePlateTooLong: '車牌號碼不可超過 10 字。',
    invalidPlates: '車牌號碼必須是陣列。',
    tooManyPlates: `目前表單最多保留 ${siteCopy.maxPlates} 個車牌號碼。`,
    confirmationRequired: '尚未取得使用者手勢或頁內明確確認，未開啟簡訊 App。',
    composerOpenFailed: '無法開啟系統簡訊 App。',
    previewWarnings: siteCopy.previewWarnings,
    confirmationPrompt: siteCopy.confirmationPrompt,
    maxPlates: siteCopy.maxPlates,
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
