import { defineConfig, devices } from '@playwright/test';

// Run against an existing production build; the normal development-server suite
// deliberately blocks Service Workers and cannot verify CSP or offline updates.
export default defineConfig({
  testDir: './e2e/strict-csp',
  testMatch: '**/*.csp.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  outputDir: 'test-results-csp',
  reporter: process.env['CI']
    ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-csp' }]]
    : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4300',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-csp-pwa',
      use: { ...devices['Pixel 7'], colorScheme: 'light' },
    },
    {
      name: 'webkit-csp-pwa',
      use: { ...devices['iPhone 14'], colorScheme: 'light' },
    },
  ],
  webServer: {
    command: 'python3 -B e2e/strict-csp/server.py --port 4300',
    url: 'http://127.0.0.1:4300/',
    reuseExistingServer: false,
    timeout: 30000,
  },
});
