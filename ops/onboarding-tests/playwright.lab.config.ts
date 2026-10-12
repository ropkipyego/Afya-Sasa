import { defineConfig } from '@playwright/test'

const baseURL = process.env.LAB_E2E_FRONTEND_URL ?? 'http://127.0.0.1:4174'

if (/:(8080|3000|5433)\b/.test(baseURL) || /localhost:8080/.test(baseURL)) {
  throw new Error(
    `Refusing Playwright laboratory UAT against ${baseURL}. Port 8080/3000/5433 may be the live local stack.`,
  )
}

export default defineConfig({
  testDir: './specs',
  testMatch: ['lab-*.spec.ts'],
  timeout: 120_000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL,
    screenshot: 'on',
    video: 'on',
    trace: 'on',
    viewport: { width: 1440, height: 900 },
  },
  ...(process.env.LAB_E2E_SKIP_WEBSERVER
    ? {}
    : {
        webServer: {
          command: 'AFYASASA_LAB_E2E=1 npx vite --port 4174 --strictPort --host 127.0.0.1',
          cwd: '../frontend',
          url: 'http://127.0.0.1:4174',
          reuseExistingServer: false,
          timeout: 120_000,
        },
      }),
  outputDir: './results/lab-e2e-output',
  reporter: [['list'], ['html', { outputFolder: './results/lab-e2e-report', open: 'never' }]],
})
