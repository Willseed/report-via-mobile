import { test, expect } from '@playwright/test';

test.describe('確認對話框', () => {
  // 使用行動裝置 viewport 以啟用發送按鈕
  test.use({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('事發地址')).toBeVisible();
  });

  test('填寫完整表單後點擊發送應顯示確認對話框', async ({ page }) => {
    // 填寫表單
    await page.getByLabel('事發地址').fill('台北市中正區重慶南路一段122號');
    await expect(page.locator('mat-select-trigger')).toContainText('臺北市');
    await page.getByLabel('違規事實').click();
    await page.getByRole('option', { name: '汽車於紅線停車' }).click();

    // 點擊發送
    await page.getByRole('button', { name: '發送簡訊' }).click();

    // 確認對話框應顯示
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('mat-dialog-content')).toContainText('中正區');
  });

  test('確認對話框應顯示承辦單位資訊', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市大安區忠孝東路四段1號');
    await expect(page.locator('mat-select-trigger')).toContainText('臺北市');
    await page.getByLabel('違規事實').click();
    await page.getByRole('option', { name: '機車於黃線停車' }).click();
    await page.getByRole('button', { name: '發送簡訊' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    // 應顯示承辦單位
    await expect(page.locator('mat-dialog-content')).toContainText('大安');
  });

  test('確認對話框應顯示簡訊內容預覽', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市信義區松仁路100號');
    await expect(page.locator('mat-select-trigger')).toContainText('臺北市');
    await page.getByLabel('違規事實').click();
    await page.getByRole('option', { name: '汽車並排停車' }).click();
    await page.getByRole('button', { name: '發送簡訊' }).click();

    await expect(page.locator('mat-dialog-content')).toContainText('松仁路100號');
    await expect(page.locator('mat-dialog-content')).toContainText('並排停車');
  });

  test('確認對話框應有確認和取消按鈕', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市中山區南京東路二段1號');
    await expect(page.locator('mat-select-trigger')).toContainText('臺北市');
    await page.getByLabel('違規事實').click();
    await page.getByRole('option', { name: '汽車於紅線停車' }).click();
    await page.getByRole('button', { name: '發送簡訊' }).click();

    await expect(page.getByRole('button', { name: '取消' })).toBeVisible();
    await expect(page.getByRole('button', { name: '確認發送' })).toBeVisible();
  });

  test('點擊取消應關閉對話框', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市中正區重慶南路一段122號');
    await expect(page.locator('mat-select-trigger')).toContainText('臺北市');
    await page.getByLabel('違規事實').click();
    await page.getByRole('option', { name: '汽車於紅線停車' }).click();
    await page.getByRole('button', { name: '發送簡訊' }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('確認對話框應顯示車牌號碼', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市松山區民生東路五段1號');
    await expect(page.locator('mat-select-trigger')).toContainText('臺北市');
    await page.getByLabel('違規事實').click();
    await page.getByRole('option', { name: '機車於騎樓停車' }).click();
    await page.getByRole('button', { name: '新增車牌號碼' }).click();
    await page.getByLabel('車牌號碼（選填）').fill('XYZ9999');
    await page.getByRole('button', { name: '發送簡訊' }).click();

    await expect(page.locator('mat-dialog-content')).toContainText('XYZ9999');
  });
});
