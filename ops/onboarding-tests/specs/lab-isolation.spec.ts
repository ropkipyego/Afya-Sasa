import { test, expect } from '@playwright/test'

test('laboratory UAT target is isolated from the default live local ports', async ({ baseURL, page }) => {
  expect(baseURL).toBeTruthy()
  expect(baseURL).toMatch(/127\.0\.0\.1:4174|localhost:4174/)
  expect(baseURL).not.toMatch(/:8080|:3000|:5433/)
  await page.route(/:(8080|3000|5433)\b/, (route) => {
    throw new Error(`Laboratory UAT attempted to reach a live-stack URL: ${route.request().url()}`)
  })
  await page.goto('/')
  await expect(page.getByLabel(/^email$/i)).toBeVisible({ timeout: 30_000 })
})
