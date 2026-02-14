import { test, expect } from '@playwright/test';

test.describe('SMS 預覽', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('事發地址')).toBeVisible();
  });

  test('填寫地址和違規事實後應顯示簡訊預覽', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市中正區測試路1號');
    await page.getByLabel('違規事實').click();
    await page.getByRole('option', { name: '汽車於紅線停車' }).click();

    await expect(page.locator('.sms-preview')).toBeVisible();
    await expect(page.locator('.sms-bubble')).toContainText('台北市中正區測試路1號');
    await expect(page.locator('.sms-bubble')).toContainText('汽車於紅線停車');
    await expect(page.locator('.sms-bubble')).toContainText('請派員處理');
  });

  test('簡訊預覽應包含車牌號碼', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市信義區測試路2號');
    await page.getByLabel('違規事實').click();
    await page.getByRole('option', { name: '機車於黃線停車' }).click();
    await page.getByRole('button', { name: '新增車牌號碼' }).click();
    await page.getByLabel('車牌號碼（選填）').fill('ABC1234');

    await expect(page.locator('.sms-bubble')).toContainText('車牌號碼：ABC1234');
  });

  test('應顯示字數計算', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市中正區測試路1號');
    await page.getByLabel('違規事實').click();
    await page.getByRole('option', { name: '汽車於紅線停車' }).click();

    await expect(page.locator('.sms-char-count')).toBeVisible();
    await expect(page.locator('.sms-char-count')).toContainText('/ 70 字');
  });

  test('超過 70 字應顯示警告', async ({ page }) => {
    // 使用較長的地址觸發超長警告
    const longAddress = '台北市中正區非常非常非常非常非常非常非常非常非常非常非常長的測試路一段二段三段123號';
    await page.getByLabel('事發地址').fill(longAddress);
    await page.getByLabel('違規事實').click();
    await page.getByRole('option', { name: '汽車違法佔用孕婦及育有六歲以下兒童者停車位' }).click();

    await expect(page.locator('.sms-char-count')).toHaveClass(/over-limit/);
    await expect(page.locator('.sms-length-warning')).toBeVisible();
    await expect(page.locator('.sms-length-warning')).toContainText('超過 70 字');
  });

  test('未填寫完整時不應顯示預覽', async ({ page }) => {
    // 只填地址，不選違規事實
    await page.getByLabel('事發地址').fill('台北市中正區測試路1號');
    await expect(page.locator('.sms-preview')).not.toBeVisible();
  });
});
