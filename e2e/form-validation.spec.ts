import { test, expect } from '@playwright/test';

test.describe('表單驗證', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('事發地址')).toBeVisible();
  });

  test('空白表單提交應顯示必填錯誤', async ({ page, isMobile }) => {
    test.skip(!isMobile, '桌面裝置發送按鈕停用');

    await page.getByRole('button', { name: '發送簡訊' }).click();
    await expect(page.getByText('請輸入事發地址')).toBeVisible();
    await expect(page.getByText('請選擇報案行政區')).toBeVisible();
    await expect(page.getByText('請選擇違規事實')).toBeVisible();
  });

  test('地址超過 100 字應顯示錯誤', async ({ page }) => {
    const longAddress = '台'.repeat(101);
    await page.getByLabel('事發地址').fill(longAddress);
    await page.getByLabel('事發地址').blur();
    await expect(page.getByText('地址不可超過 100 字')).toBeVisible();
  });

  test('車牌號碼含特殊字元應顯示錯誤', async ({ page }) => {
    await page.getByRole('button', { name: '新增車牌號碼' }).click();
    const plateInput = page.getByLabel('車牌號碼（選填）');
    // 輸入含特殊字元（會被過濾，但如果繞過會觸發驗證）
    await plateInput.evaluate((el: HTMLInputElement) => {
      el.value = 'ABC-123!';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // 特殊字元會被過濾，所以應該只剩下 ABC123
    await expect(plateInput).toHaveValue('ABC123');
  });
});

test.describe('行政區不一致警告', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('事發地址')).toBeVisible();
  });

  test('地址與選擇行政區不一致應顯示警告', async ({ page }) => {
    // 輸入台北市地址
    await page.getByLabel('事發地址').fill('台北市中正區重慶南路一段122號');
    await page.waitForTimeout(400);

    // 確認自動選擇了臺北市
    await expect(page.locator('mat-select-trigger')).toContainText('臺北市');

    // 手動改選新北市
    await page.getByLabel('報案行政區').click();
    await page.getByRole('option', { name: '新北市' }).click();

    // 應顯示不一致警告
    await expect(page.locator('.district-mismatch-warning')).toBeVisible();
    await expect(page.locator('.district-mismatch-warning')).toContainText('行政區不一致');
  });

  test('行政區不一致時發送按鈕應停用', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市中正區重慶南路一段122號');
    await page.waitForTimeout(400);
    await page.getByLabel('報案行政區').click();
    await page.getByRole('option', { name: '新北市' }).click();
    const violationInput = page.getByRole('combobox', { name: '違規事實' });
    await violationInput.click();
    await page.getByRole('option', { name: '汽車於紅線停車' }).click();

    await expect(page.getByRole('button', { name: '發送簡訊' })).toBeDisabled();
  });

  test('修正行政區後警告應消失', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市中正區重慶南路一段122號');
    await page.waitForTimeout(400);
    await page.getByRole('combobox', { name: '報案行政區' }).click();
    await page.getByRole('option', { name: '新北市' }).click();
    await expect(page.locator('.district-mismatch-warning')).toBeVisible();

    // 改回臺北市
    await page.getByRole('combobox', { name: '報案行政區' }).click();
    await page.getByRole('option', { name: '臺北市' }).click();
    await expect(page.locator('.district-mismatch-warning')).not.toBeVisible();
  });
});
