import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __webMcpTools?: unknown[];
  }
}

test.describe('瀏覽器 WebMCP', () => {
  test('可連續查詢、填寫與預覽，未確認不開啟簡訊 App', async ({ page }) => {
    await page.addInitScript(() => {
      const registeredTools: unknown[] = [];
      Object.defineProperty(document, 'modelContext', {
        configurable: true,
        value: {
          registerTool(tool: unknown) {
            registeredTools.push(tool);
          },
        },
      });
      Object.defineProperty(window, '__webMcpTools', {
        configurable: true,
        value: registeredTools,
      });
      Object.defineProperty(navigator, 'userActivation', {
        configurable: true,
        value: { isActive: false, hasBeenActive: false },
      });
    });
    page.on('dialog', (dialog) => dialog.dismiss());

    await page.goto('/');
    await expect
      .poll(() => page.evaluate(() => (window.__webMcpTools as unknown[] | undefined)?.length ?? 0))
      .toBe(5);

    const result = await page.evaluate(async () => {
      const tools = window.__webMcpTools as Array<{
        name: string;
        execute(input?: unknown): unknown | Promise<unknown>;
      }>;
      const call = (name: string, input?: unknown) =>
        tools.find((tool) => tool.name === name)?.execute(input);
      const list = (await call('list_violation_types')) as {
        violationTypes: string[];
      };
      await call('lookup_station', { address: '臺北市信義區市府路1號' });
      await call('set_report_form', {
        address: '臺北市信義區市府路1號',
        district: '臺北市',
        violation: list.violationTypes[0],
        plates: ['abc-123'],
      });
      const preview = await call('preview_sms');
      const open = await call('open_sms_composer');

      return { list, preview, open };
    });

    expect(result.list.violationTypes.length).toBeGreaterThan(0);
    expect(result.preview).toMatchObject({
      ok: true,
      to: '0911510914',
      warnings: ['尚未送出', '非官方', '需使用者確認'],
    });
    expect(result.open).toMatchObject({ ok: true, opened: false });
  });
});
