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
    fallbackHint: '自動定位暫時無法使用，請手動輸入地址與選擇行政區。',
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
    desktopWarning: '簡訊連結可能無法在桌面瀏覽器上使用，請使用行動裝置開啟。',
    freeNotice: '發送此簡訊是免費的。',
    pendingPreviewHint: '待選擇行政區後顯示簡訊預覽…',
    districtMismatchWarning: '輸入地址與報案行政區不一致，請確認後再發送。',
    legalNotice: '報案的受理與否，最終由該轄區警察局依法審核決定。',
    sendButton: '發送簡訊',
    disclaimerTitle: '免責聲明',
    disclaimerP1: '檢舉是否受理及後續罰鍰裁處，悉依警察機關及相關交通法規辦理；本工具與內政部警政署或各級警察局無官方隸屬關係。',
    disclaimerP2: '免責事項：本工具僅供輔助生成交通違規檢舉簡訊內容，不代表檢舉成功之保證；使用者送出前應自行核對違規時間、地點及事實之正確性。若因輸入資料錯誤致生法律糾紛或行政處分，本站概不負責。',
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
