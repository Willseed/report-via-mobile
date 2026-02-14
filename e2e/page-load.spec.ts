import { test, expect } from '@playwright/test';

test.describe('頁面載入', () => {
  test('應顯示頁面標題「簡訊報案」', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('簡訊報案');
  });

  test('應顯示副標題說明', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.subtitle')).toContainText('填寫以下表單');
  });

  test('應渲染表單欄位', async ({ page }) => {
    await page.goto('/');
    // 等待 defer 載入完成
    await expect(page.getByLabel('事發地址')).toBeVisible();
    await expect(page.getByLabel('報案行政區')).toBeVisible();
    await expect(page.getByLabel('違規事實')).toBeVisible();
  });

  test('應顯示免費簡訊提示', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.info-banner')).toContainText('發送此簡訊是免費的');
  });

  test('應顯示法律提示', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.notice-banner')).toContainText('報案的受理與否');
  });
});

test.describe('桌面裝置警告', () => {
  test('桌面瀏覽器應顯示警告訊息', async ({ page, isMobile }) => {
    test.skip(isMobile, '僅限桌面瀏覽器測試');
    // Desktop Chrome project 會使用桌面 user agent
    await page.goto('/');
    await expect(page.locator('.desktop-warning')).toBeVisible();
    await expect(page.locator('.desktop-warning')).toContainText('行動裝置');
  });

  test('桌面瀏覽器發送按鈕應停用', async ({ page, isMobile }) => {
    test.skip(isMobile, '僅限桌面瀏覽器測試');
    await page.goto('/');
    await expect(page.getByRole('button', { name: '發送簡訊' })).toBeDisabled();
  });
});

test.describe('行動裝置', () => {
  test('行動裝置不應顯示桌面警告', async ({ page, isMobile }) => {
    test.skip(!isMobile, '僅限行動裝置測試');
    await page.goto('/');
    await expect(page.locator('.desktop-warning')).not.toBeVisible();
  });
});
