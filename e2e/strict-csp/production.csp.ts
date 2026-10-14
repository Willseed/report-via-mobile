import { expect, test, type BrowserContext, type Page, type Response } from '@playwright/test';

interface CspViolation {
  directive: string;
  blockedURI: string;
}

type CspObserverWindow = typeof globalThis & {
  recordCspViolation: (violation: CspViolation) => Promise<void>;
};

type InstallPromptWindow = typeof globalThis & {
  naturalInstallPromptSeen?: boolean;
};

async function observeCsp(context: BrowserContext): Promise<CspViolation[]> {
  const violations: CspViolation[] = [];
  await context.exposeFunction('recordCspViolation', (violation: CspViolation) => {
    violations.push(violation);
  });
  await context.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      void (globalThis as CspObserverWindow).recordCspViolation({
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI,
      });
    });
  });
  return violations;
}

function expectStrictStylePolicy(response: Response | null): void {
  expect(response?.ok()).toBe(true);
  expect(response?.headers()['cross-origin-opener-policy']).toBe('same-origin');
  expect(response?.headers()['cross-origin-embedder-policy']).toBe('require-corp');
  const policy = response?.headers()['content-security-policy'] ?? '';
  const directives = policy.split(';').map((directive) => directive.trim().split(/\s+/));
  expect(directives.filter(([name]) => name === 'default-src')).toEqual([
    ['default-src', "'none'"],
  ]);
  for (const directive of ['font-src', 'manifest-src', 'worker-src']) {
    expect(directives.filter(([name]) => name === directive)).toEqual([[directive, "'self'"]]);
  }
  const styleSources = directives.filter(([name]) => name === 'style-src');
  expect(styleSources).toHaveLength(1);
  expect(styleSources[0].some((source) => source.startsWith("'sha256-"))).toBe(true);
  const allStyleSources = directives
    .filter(([name]) => ['style-src', 'style-src-elem', 'style-src-attr'].includes(name))
    .flat();
  expect(allStyleSources).not.toContain("'unsafe-inline'");
  expect(directives.filter(([name]) => name === 'style-src-attr')).toEqual([
    ['style-src-attr', "'none'"],
  ]);
}

async function openProductionPage(page: Page): Promise<void> {
  expectStrictStylePolicy(await page.goto('/'));
  expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(true);
  await expect(page.getByLabel('事發地址')).toBeVisible();
  await expect(page.locator('app-sms-form')).toHaveCSS('display', 'flex');
}

async function waitForServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect
    .poll(() => page.evaluate(async () => (await fetch('/ngsw/state')).text()))
    .toContain('Driver state: NORMAL');
}

async function fillDraftAndOpenDialog(page: Page): Promise<void> {
  await page.getByLabel('報案行政區').click();
  await page.getByRole('option', { name: '臺北市', exact: true }).click();
  await expect(page.locator('mat-select-trigger')).toHaveText('臺北市');
  await page.getByLabel('事發地址').fill('臺北市中正區重慶南路一段122號');
  const violation = page.getByRole('combobox', { name: '違規事實' });
  await violation.fill('汽車');
  await page.getByRole('option', { name: '汽車於紅線停車', exact: true }).click();
  await expect(violation).toHaveValue('汽車於紅線停車');
  await page.getByRole('button', { name: '新增車牌號碼' }).click();
  await page.getByLabel('車牌號碼（選填）').fill('abc1234');
  await expect(page.getByLabel('車牌號碼（選填）')).toHaveValue('ABC1234');
  await expect(page.locator('app-sms-preview')).toContainText('ABC1234');
  await page.getByRole('button', { name: '開啟簡訊 App', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('ABC1234');
  await expect(dialog).toContainText('汽車於紅線停車');
  await expect(dialog.locator('mat-dialog-content')).toHaveCSS('overflow', 'auto');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ request }) => {
  const response = await request.post('/__csp-test-release', {
    data: 'a',
    headers: { 'Content-Type': 'text/plain' },
  });
  expect(response.ok()).toBe(true);
});

test('production CSP permits actual controls, lazy dialog, and theme changes', async ({
  context,
  page,
}) => {
  const violations = await observeCsp(context);
  await openProductionPage(page);
  await page.getByRole('button', { name: '切換為深色模式' }).click();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await page.getByRole('button', { name: '切換為淺色模式' }).click();
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light');
  await fillDraftAndOpenDialog(page);
  await page.getByRole('button', { name: '移除車牌號碼' }).click();
  await expect(page.getByRole('button', { name: '新增車牌號碼' })).toBeVisible();
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect(page.locator('details.disclaimer')).toBeVisible();
  expect(violations).toEqual([]);
});

test.describe('production geolocation with cross-origin isolation', () => {
  // This case validates the page's external CORS request. The separate PWA cases
  // exercise real Service Workers; blocking them here keeps interception portable.
  test.use({ serviceWorkers: 'block' });

  test('keeps GPS reverse geocoding usable with a CORS-only response', async ({ context, page }) => {
    const violations = await observeCsp(context);
    const requestedCoordinates: string[][] = [];
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 25.033, longitude: 121.5654 });
    await context.route('https://nominatim.openstreetmap.org/reverse?*', async (route) => {
      const request = route.request();
      const headers = {
        'Access-Control-Allow-Origin': 'http://127.0.0.1:4300',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'User-Agent',
      };
      if (request.method() === 'OPTIONS') {
        await route.fulfill({ status: 204, headers });
        return;
      }
      const params = new URL(request.url()).searchParams;
      requestedCoordinates.push([params.get('lat') ?? '', params.get('lon') ?? '']);
      await route.fulfill({
        status: 200,
        headers,
        contentType: 'application/json',
        body: JSON.stringify({
          display_name: '臺北市中正區重慶南路一段122號',
          address: {
            city: '臺北市',
            suburb: '中正區',
            road: '重慶南路一段',
            house_number: '122號',
          },
        }),
      });
    });
    await openProductionPage(page);
    await page.getByRole('button', { name: '使用目前位置' }).click();
    await expect(page.getByLabel('事發地址')).toHaveValue(/臺北市中正區/);
    await expect(page.locator('mat-select-trigger')).toHaveText('臺北市');
    expect(requestedCoordinates).toEqual([['25.033', '121.5654']]);
    expect(violations).toEqual([]);
  });
});

test('production CSP blocks unapproved style elements and style attributes', async ({
  context,
  page,
}) => {
  const violations = await observeCsp(context);
  await openProductionPage(page);
  const colors = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'unapproved-csp-probe';
    probe.textContent = 'CSP validation probe';
    document.body.append(probe);
    const original = {
      color: getComputedStyle(probe).color,
      background: getComputedStyle(probe).backgroundColor,
    };
    const stylesheet = document.createElement('style');
    stylesheet.textContent = '.unapproved-csp-probe { color: rgb(1, 2, 3); }';
    document.head.append(stylesheet);
    probe.setAttribute('style', 'background-color: rgb(7, 8, 9)');
    return {
      original,
      actual: {
        color: getComputedStyle(probe).color,
        background: getComputedStyle(probe).backgroundColor,
      },
    };
  });
  expect(colors.actual).toEqual(colors.original);
  await expect
    .poll(() => violations.map(({ directive }) => directive))
    .toEqual(expect.arrayContaining(['style-src-elem', 'style-src-attr']));
  expect(violations.every(({ blockedURI }) => blockedURI === 'inline')).toBe(true);
});

test('real Service Worker preserves build integrity and renders the app after offline reload', async ({
  context,
  page,
  request,
}) => {
  const violations = await observeCsp(context);
  await openProductionPage(page);
  await waitForServiceWorker(page);
  const manifestResponse = await request.get('/ngsw.json');
  const manifest = await manifestResponse.json();
  const precachedPaths: string[] = manifest.assetGroups.find(
    (group: { name: string }) => group.name === 'app',
  ).urls;
  const failures = await page.evaluate(
    async ({ paths, hashes }: { paths: string[]; hashes: Record<string, string> }) => {
      const results = await Promise.all(
        paths.map(async (path) => {
          const response = await fetch(path);
          const bytes = await response.arrayBuffer();
          // Match Angular ngsw's asset checksum format; this does not authenticate content.
          // nosemgrep: rules_lgpl_javascript_crypto_rule-node-sha1
          const digest = await crypto.subtle.digest('SHA-1', bytes); // NOSONAR: ngsw checksum only.
          const actual = Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, '0'),
          ).join('');
          return !response.ok || actual !== hashes[path] ? path : null;
        }),
      );
      return results.filter((path) => path !== null);
    },
    { paths: precachedPaths, hashes: manifest.hashTable },
  );
  expect(failures).toEqual([]);
  await context.setOffline(true);
  const response = await page.reload();
  expect(response?.fromServiceWorker()).toBe(true);
  expectStrictStylePolicy(response);
  expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(true);
  await expect(page.getByLabel('事發地址')).toBeVisible();
  await expect(page.getByText('目前為離線狀態，無法使用定位功能。')).toBeVisible();
  await expect(page.getByRole('button', { name: '使用目前位置' })).toBeDisabled();
  await fillDraftAndOpenDialog(page);
  expect(violations).toEqual([]);
});

test('production manifest meets Chromium installability checks under the strict CSP', async ({
  browserName,
  context,
  page,
}, testInfo) => {
  test.skip(browserName !== 'chromium', 'Chromium exposes its actual installability diagnostics.');
  const violations = await observeCsp(context);
  await page.addInitScript(() => {
    globalThis.addEventListener('beforeinstallprompt', () => {
      (globalThis as InstallPromptWindow).naturalInstallPromptSeen = true;
    });
  });
  await openProductionPage(page);
  await waitForServiceWorker(page);
  const session = await context.newCDPSession(page);
  const manifest = await session.send('Page.getAppManifest');
  expect(manifest.errors).toEqual([]);
  const diagnostics = await session.send('Page.getInstallabilityErrors');
  expect(diagnostics.installabilityErrors).toEqual([]);
  // Browsers decide when to offer installation; never synthesize that event or
  // trigger a native installation. Validate our real snackbar if it is offered.
  const naturallyOffered = await page.evaluate(
    () => !!(globalThis as InstallPromptWindow).naturalInstallPromptSeen,
  );
  if (naturallyOffered) {
    const snackBar = page.locator('mat-snack-bar-container');
    await expect(snackBar).toContainText('可將此應用安裝至主畫面');
    await expect(snackBar.getByRole('button', { name: '安裝', exact: true })).toBeVisible();
  } else {
    testInfo.annotations.push({
      type: 'install-prompt',
      description: 'Manifest is installable; Chromium did not offer a natural install prompt.',
    });
  }
  await session.detach();
  expect(violations).toEqual([]);
});

test('a real hash-valid PWA update waits for the update action and keeps working offline', async ({
  browserName,
  context,
  page,
  request,
}) => {
  test.skip(browserName !== 'chromium', 'The update action is exercised with the real Chromium SW.');
  const violations = await observeCsp(context);
  await openProductionPage(page);
  await waitForServiceWorker(page);
  const releaseA = await page.evaluate(async () => (await fetch('/llms.txt')).text());
  const switched = await request.post('/__csp-test-release', {
    data: 'b',
    headers: { 'Content-Type': 'text/plain' },
  });
  expect(switched.ok()).toBe(true);
  // A new real navigation schedules Angular's normal Service Worker update check.
  const secondPage = await context.newPage();
  await secondPage.goto('/');
  const snackBar = page.locator('mat-snack-bar-container');
  await expect(snackBar).toContainText('有新版本可用', { timeout: 45000 });
  await expect(snackBar).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('/llms.txt')).text())).toBe(releaseA);
  await secondPage.close();
  await Promise.all([
    page.waitForEvent('load'),
    snackBar.getByRole('button', { name: '更新', exact: true }).click(),
  ]);
  await expect(page.getByLabel('事發地址')).toBeVisible();
  await expect
    .poll(() => page.evaluate(async () => (await fetch('/llms.txt')).text()))
    .toBe(`${releaseA}\nCSP browser test release B.\n`);
  await context.setOffline(true);
  const response = await page.reload();
  expect(response?.fromServiceWorker()).toBe(true);
  expectStrictStylePolicy(response);
  expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(true);
  await expect(page.getByLabel('事發地址')).toBeVisible();
  await fillDraftAndOpenDialog(page);
  expect(violations).toEqual([]);
});
