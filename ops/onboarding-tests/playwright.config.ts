import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './specs',
  timeout: 180_000,
  retries: 0,
  use: {
    baseURL: process.env.FRONTEND_URL ?? 'http://localhost:8080',
    screenshot: 'on',
    video: 'on',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  outputDir: './results/playwright-output',
  reporter: [['list'], ['html', { outputFolder: './results/playwright-report', open: 'never' }]],
})
