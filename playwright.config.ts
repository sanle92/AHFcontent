import { defineConfig, devices } from '@playwright/test';
const staging = process.env.AHF_E2E_STAGING_ORIGIN;
export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: staging || 'http://127.0.0.1:4173',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: staging
    ? undefined
    : {
        command: 'pnpm preview --ip 127.0.0.1 --port 4173',
        url: 'http://127.0.0.1:4173',
        timeout: 60000,
        reuseExistingServer: !process.env.CI,
      },
});
