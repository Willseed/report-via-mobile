import { test, expect, type Page } from '@playwright/test';

async function fillRequiredForm(
  page: Page,
  { address, violation }: { address: string; violation: string },
): Promise<void> {
  await page.getByLabel('事發地址').fill(address);
  await expect(page.locator('mat-select-trigger')).toContainText('臺北市');
  await page.getByLabel('違規事實').click();
  await page.getByRole('option', { name: violation }).click();
}

async function openConfirmDialog(
  page: Page,
  form: { address: string; violation: string },
): Promise<void> {
  await fillRequiredForm(page, form);
  await page.getByRole('button', { name: '發送簡訊' }).click();
}

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
    await openConfirmDialog(page, {
      address: '台北市中正區重慶南路一段122號',
      violation: '汽車於紅線停車',
    });

    // 確認對話框應顯示
    await expect(page.getByRole('dialog')).toBeVisible();
    const dialogContent = page.locator('mat-dialog-content');
    await expect(dialogContent).toContainText('中正區');
  });

  [
    {
      name: '確認對話框應顯示承辦單位資訊',
      address: '台北市大安區忠孝東路四段1號',
      violation: '機車於黃線停車',
      expectedTexts: ['大安'],
    },
    {
      name: '確認對話框應顯示簡訊內容預覽',
      address: '台北市信義區松仁路100號',
      violation: '汽車並排停車',
      expectedTexts: ['松仁路100號', '並排停車'],
    },
  ].forEach(({ name, address, violation, expectedTexts }) => {
    test(name, async ({ page }) => {
      await openConfirmDialog(page, { address, violation });

      await expect(page.getByRole('dialog')).toBeVisible();
      const dialogContent = page.locator('mat-dialog-content');
      for (const expectedText of expectedTexts) {
        await expect(dialogContent).toContainText(expectedText);
      }
    });
  });

  test('確認對話框應有確認和取消按鈕', async ({ page }) => {
    await openConfirmDialog(page, {
      address: '台北市中山區南京東路二段1號',
      violation: '汽車於紅線停車',
    });

    await expect(page.getByRole('button', { name: '取消' })).toBeVisible();
    await expect(page.getByRole('button', { name: '確認發送' })).toBeVisible();
  });

  test('點擊取消應關閉對話框', async ({ page }) => {
    await openConfirmDialog(page, {
      address: '台北市中正區重慶南路一段122號',
      violation: '汽車於紅線停車',
    });

    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('確認對話框應顯示車牌號碼', async ({ page }) => {
    await fillRequiredForm(page, {
      address: '台北市松山區民生東路五段1號',
      violation: '機車於騎樓停車',
    });
    await page.getByRole('button', { name: '新增車牌號碼' }).click();
    await page.getByLabel('車牌號碼（選填）').fill('XYZ9999');
    await page.getByRole('button', { name: '發送簡訊' }).click();

    const dialogContent = page.locator('mat-dialog-content');
    await expect(dialogContent).toContainText('XYZ9999');
  });
});
