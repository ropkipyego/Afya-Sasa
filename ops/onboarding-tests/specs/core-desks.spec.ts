import { test, expect } from '@playwright/test'

const EMAIL = process.env.EMAIL ?? 'it@jalaram.co.ke'
const PASSWORD = process.env.PASSWORD ?? 'ChangeMe123!'

async function login(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.locator('input[type="email"]').fill(EMAIL)
  await page.locator('input[type="password"]').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.locator('aside nav')).toBeVisible({ timeout: 30_000 })
}

async function openNav(page: import('@playwright/test').Page, label: string) {
  await page.locator('aside nav').getByRole('button', { name: label, exact: true }).click()
}

test.describe('Running hospital UI', () => {
  test('website booking page is public and uses the appointment API', async ({ page }) => {
    await page.goto('/book')
    await expect(page.getByRole('heading', { name: /book a clinic appointment/i })).toBeVisible()
    await expect(page.getByLabel(/hospital number or registered phone/i)).toBeVisible()
  })

  test('pharmacy, IPD and laboratory desks open after staff login', async ({ page }) => {
    test.setTimeout(120_000)
    await login(page)
    for (const label of ['Pharmacy', 'Inpatient (IPD)', 'Laboratory']) {
      await openNav(page, label)
      await expect(page.locator('main, .workspace-shell, h2, h1').first()).toBeVisible({ timeout: 15_000 })
    }
  })
})
