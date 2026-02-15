import { test, expect, Page } from '@playwright/test';

/**
 * Mock geolocation API 並返回指定座標
 */
async function mockGeolocation(page: Page, latitude: number, longitude: number): Promise<void> {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude, longitude });
}

/**
 * Mock geolocation API 以拒絕權限
 */
async function mockGeolocationDenied(page: Page): Promise<void> {
  await page.context().clearPermissions();
  // 注入 geolocation mock 以模擬權限被拒絕
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (
      _success: PositionCallback,
      error?: PositionErrorCallback,
    ) => {
      if (error) {
        error({
          code: 1, // PERMISSION_DENIED
          message: '使用者拒絕地理位置權限',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      }
    };
  });
}

/**
 * Mock geolocation API 以模擬逾時
 */
async function mockGeolocationTimeout(page: Page): Promise<void> {
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (
      _success: PositionCallback,
      error?: PositionErrorCallback,
    ) => {
      if (error) {
        error({
          code: 3, // TIMEOUT
          message: '定位逾時',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      }
    };
  });
}

test.describe('GPS 定位功能', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('事發地址')).toBeVisible();
  });

  test('成功定位應填入地址並自動選擇行政區', async ({ page }) => {
    // Mock 台北市中正區座標
    await mockGeolocation(page, 25.0330, 121.5654);

    // Mock Nominatim API 回應
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          display_name: '台北市中正區重慶南路一段122號',
          address: {
            city: '台北市',
            suburb: '中正區',
            road: '重慶南路一段',
            house_number: '122號',
          },
        }),
      });
    });

    // 點擊定位按鈕
    await page.getByRole('button', { name: '使用目前位置' }).click();

    // 等待地址欄位被填入
    await expect(page.getByLabel('事發地址')).toHaveValue(/台北市/);
    // 等待行政區自動選擇
    await expect(page.locator('mat-select-trigger')).toContainText('臺北市');
  });

  test('定位時應顯示載入狀態', async ({ page }) => {
    await mockGeolocation(page, 25.0330, 121.5654);

    // Mock 慢速 API 回應
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          display_name: '台北市中正區',
          address: { city: '台北市', suburb: '中正區' },
        }),
      });
    });

    await page.getByRole('button', { name: '使用目前位置' }).click();

    // 按鈕應顯示載入中狀態（停用）
    await expect(page.getByRole('button', { name: '使用目前位置' })).toBeDisabled();
  });

  test('定位完成後按鈕應恢復可用', async ({ page }) => {
    await mockGeolocation(page, 25.0330, 121.5654);

    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          display_name: '台北市中正區',
          address: { city: '台北市', suburb: '中正區' },
        }),
      });
    });

    await page.getByRole('button', { name: '使用目前位置' }).click();
    await expect(page.getByLabel('事發地址')).toHaveValue(/台北市/);

    // 按鈕應恢復可用
    await expect(page.getByRole('button', { name: '使用目前位置' })).toBeEnabled();
  });

  test('定位新北市座標應選擇新北市行政區', async ({ page }) => {
    // Mock 新北市板橋區座標
    await mockGeolocation(page, 25.0144, 121.4671);

    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          display_name: '新北市板橋區中山路一段161號',
          address: {
            county: '新北市',
            suburb: '板橋區',
            road: '中山路一段',
            house_number: '161號',
          },
        }),
      });
    });

    await page.getByRole('button', { name: '使用目前位置' }).click();

    await expect(page.getByLabel('事發地址')).toHaveValue(/新北市/);
    await expect(page.locator('mat-select-trigger')).toContainText('新北市');
  });
});

test.describe('定位錯誤處理', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('事發地址')).toBeVisible();
  });

  test('權限被拒絕應顯示錯誤訊息', async ({ page }) => {
    await mockGeolocationDenied(page);
    await page.goto('/');

    await page.getByRole('button', { name: '使用目前位置' }).click();

    await expect(page.getByText('定位權限被拒絕')).toBeVisible();
  });

  test('定位逾時應顯示錯誤訊息', async ({ page }) => {
    await mockGeolocationTimeout(page);
    await page.goto('/');

    await page.getByRole('button', { name: '使用目前位置' }).click();

    await expect(page.getByText(/定位逾時|定位失敗/)).toBeVisible();
  });

  test('Geocoding API 失敗應顯示錯誤訊息', async ({ page }) => {
    await mockGeolocation(page, 25.0330, 121.5654);

    // Mock API 錯誤
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.getByRole('button', { name: '使用目前位置' }).click();

    await expect(page.getByText(/地址查詢失敗|無法解析地址/)).toBeVisible();
  });

  test('成功定位後錯誤訊息應清除', async ({ page }) => {
    // 先製造 API 錯誤
    await mockGeolocation(page, 25.0330, 121.5654);
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    await page.getByRole('button', { name: '使用目前位置' }).click();
    await expect(page.getByText(/地址查詢失敗|定位失敗/)).toBeVisible();

    // 改為成功回應
    await page.unroute('**/nominatim.openstreetmap.org/**');
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          display_name: '台北市中正區',
          address: { city: '台北市', suburb: '中正區' },
        }),
      });
    });

    // 再次點擊
    await page.getByRole('button', { name: '使用目前位置' }).click();

    // 應成功並清除錯誤
    await expect(page.getByLabel('事發地址')).toHaveValue(/台北市/);
    await expect(page.getByText(/地址查詢失敗|定位失敗/)).not.toBeVisible();
  });
});

test.describe('API 錯誤處理 - 網路狀態', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('事發地址')).toBeVisible();
  });

  test('網路斷線應顯示適當錯誤', async ({ page }) => {
    await mockGeolocation(page, 25.0330, 121.5654);

    // Mock 網路錯誤
    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.abort('connectionfailed');
    });

    await page.getByRole('button', { name: '使用目前位置' }).click();

    await expect(page.getByText(/地址查詢失敗|定位失敗/)).toBeVisible();
  });

  test('API 回傳空資料應顯示錯誤', async ({ page }) => {
    await mockGeolocation(page, 25.0330, 121.5654);

    await page.route('**/nominatim.openstreetmap.org/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.getByRole('button', { name: '使用目前位置' }).click();

    await expect(page.getByText(/無法解析地址/)).toBeVisible();
  });
});
