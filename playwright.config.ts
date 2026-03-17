import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: '__tests__/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: 'coverage/playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'DATA_DIR=.data-e2e API_PORT=3101 API_PROXY_TARGET=http://localhost:3101 npm run dashboard',
    cwd: '.',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 90000,
  },
})
