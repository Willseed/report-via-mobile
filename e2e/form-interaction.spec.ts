import { test, expect } from '@playwright/test';

test.describe('表單互動', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待 defer 載入
    await expect(page.getByLabel('事發地址')).toBeVisible();
  });

  test('輸入台北市地址應自動選擇對應行政區', async ({ page }) => {
    await page.getByLabel('事發地址').fill('台北市中正區重慶南路一段122號');
    // 等待 debounce (300ms)
    await page.waitForTimeout(400);
    await expect(page.getByText('承辦單位')).toBeVisible();
    await expect(page.locator('mat-select-trigger')).toContainText('臺北市');
  });

  test('輸入新北市地址應自動選擇對應行政區', async ({ page }) => {
    await page.getByLabel('事發地址').fill('新北市板橋區中山路一段161號');
    await page.waitForTimeout(400);
    await expect(page.locator('mat-select-trigger')).toContainText('新北市');
  });

  test('違規事實應有自動完成功能', async ({ page }) => {
    const violationInput = page.getByRole('combobox', { name: '違規事實' });
    await violationInput.click();
    await violationInput.fill('汽車');
    // 應顯示 autocomplete 面板
    await expect(page.getByRole('option', { name: '汽車於紅線停車' })).toBeVisible();
  });

  test('選擇違規事實應填入欄位', async ({ page }) => {
    const violationInput = page.getByRole('combobox', { name: '違規事實' });
    await violationInput.click();
    await violationInput.fill('機車');
    await page.getByRole('option', { name: '機車並排停車' }).click();
    await expect(violationInput).toHaveValue('機車並排停車');
  });

  test('點擊「新增車牌號碼」應顯示車牌欄位', async ({ page }) => {
    await page.getByRole('button', { name: '新增車牌號碼' }).click();
    await expect(page.getByLabel('車牌號碼（選填）')).toBeVisible();
  });

  test('車牌號碼應自動轉換為大寫', async ({ page }) => {
    await page.getByRole('button', { name: '新增車牌號碼' }).click();
    const plateInput = page.getByLabel('車牌號碼（選填）');
    await plateInput.fill('abc1234');
    await expect(plateInput).toHaveValue('ABC1234');
  });

  test('點擊移除按鈕應隱藏車牌欄位', async ({ page }) => {
    await page.getByRole('button', { name: '新增車牌號碼' }).click();
    await expect(page.getByLabel('車牌號碼（選填）')).toBeVisible();
    await page.getByRole('button', { name: '移除車牌號碼' }).click();
    await expect(page.getByLabel('車牌號碼（選填）')).not.toBeVisible();
    await expect(page.getByRole('button', { name: '新增車牌號碼' })).toBeVisible();
  });

  test('定位按鈕應可點擊', async ({ page }) => {
    const locateButton = page.getByRole('button', { name: '使用目前位置' });
    await expect(locateButton).toBeVisible();
    await expect(locateButton).toBeEnabled();
  });
});

test.describe('行政區選擇', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('報案行政區')).toBeVisible();
  });

  test('應可手動選擇行政區', async ({ page }) => {
    await page.getByLabel('報案行政區').click();
    await page.getByRole('option', { name: '臺北市' }).click();
    await expect(page.locator('mat-select-trigger')).toContainText('臺北市');
    await expect(page.getByText('承辦單位')).toBeVisible();
  });

  test('行政區選單應包含各縣市', async ({ page }) => {
    await page.getByLabel('報案行政區').click();
    await expect(page.getByRole('option', { name: '臺北市' })).toBeVisible();
    await expect(page.getByRole('option', { name: '新北市' })).toBeVisible();
    await expect(page.getByRole('option', { name: '桃園市' })).toBeVisible();
  });
});
