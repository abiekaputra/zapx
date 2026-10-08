import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  retries: process.env.CI ? 1 : 0,
  testDir: './tests/browser',
  timeout: 60_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:3000',
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @zapx/api dev',
      reuseExistingServer: true,
      timeout: 60_000,
      url: 'http://127.0.0.1:4000/ready',
    },
    {
      command: 'pnpm --filter @zapx/worker dev',
      reuseExistingServer: true,
      timeout: 60_000,
      url: 'http://127.0.0.1:4001/ready',
    },
    {
      command: 'pnpm --filter @zapx/webhook-receiver dev',
      reuseExistingServer: true,
      timeout: 60_000,
      url: 'http://127.0.0.1:4010/health',
    },
    {
      command: 'pnpm --filter @zapx/web dev --host 127.0.0.1',
      reuseExistingServer: true,
      timeout: 60_000,
      url: 'http://127.0.0.1:3000',
    },
  ],
});
