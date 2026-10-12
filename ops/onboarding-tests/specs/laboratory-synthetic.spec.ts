import { test, expect } from '@playwright/test'

/**
 * Browser laboratory UAT against a synthetic stack only.
 * Skips unless LAB_E2E=1. Never pointed at production.
 */
const enabled = process.env.LAB_E2E === '1'

test.describe('synthetic laboratory workflow', () => {
  test.skip(!enabled, 'Set LAB_E2E=1 against an isolated synthetic frontend, not production')

  test('refuses to run against the default live local URL without an explicit synthetic origin', async ({
    page,
  }) => {
    const origin = process.env.FRONTEND_URL ?? ''
    expect(origin.includes('synthetic') || origin.includes('localhost:4173')).toBeTruthy()
    await page.goto('/')
    await expect(page.locator('body')).toBeVisible()
  })
})
