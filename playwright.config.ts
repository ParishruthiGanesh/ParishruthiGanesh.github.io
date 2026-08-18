import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against the production build served statically, which is
 * exactly what GitHub Pages will serve.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'on-first-retry',
    /*
     * Some environments (this repo's remote sandbox, for one) ship a Chromium
     * build that does not match the revision this @playwright/test expects.
     * Point PLAYWRIGHT_CHROMIUM_PATH at that binary and the tests run against
     * it instead of demanding `npx playwright install`. In CI the workflow
     * installs the matching browser and leaves this unset.
     */
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npx astro preview --port 4321 --host 127.0.0.1',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
