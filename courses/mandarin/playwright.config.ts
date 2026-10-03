import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 }, colorScheme: 'light' } },
    { name: 'mobile', use: { viewport: { width: 375, height: 812 }, colorScheme: 'light', hasTouch: true } },
    { name: 'mobile-dark', use: { viewport: { width: 375, height: 812 }, colorScheme: 'dark', hasTouch: true } },
    { name: 'narrow', use: { viewport: { width: 320, height: 640 }, colorScheme: 'light', hasTouch: true } },
  ],
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});
