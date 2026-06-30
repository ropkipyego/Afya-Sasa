import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const OUT = path.join(__dirname, '..', 'results', 'screenshots')
const TENANT = process.env.TENANT ?? 'demo'
const EMAIL = process.env.EMAIL ?? 'admin@demo.afyasasa.local'
const PASSWORD = process.env.PASSWORD ?? 'ChangeMe123!'

fs.mkdirSync(OUT, { recursive: true })

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true })
}

async function login(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByText('Tenant', { exact: true }).locator('..').locator('input').fill(TENANT)
  await page.getByText('Email', { exact: true }).locator('..').locator('input').fill(EMAIL)
  await page.getByText('Password', { exact: true }).locator('..').locator('input').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expect(page.locator('aside nav')).toBeVisible({ timeout: 30_000 })
  await shot(page, '01-login-success')
}

/** Desktop sidebar — avoids hidden mobile hamburger duplicates */
async function openNav(page: import('@playwright/test').Page, label: string) {
  await page.locator('aside nav').getByRole('button', { name: label, exact: true }).click()
  await expect(page.getByRole('heading', { name: label, level: 2 })).toBeVisible({ timeout: 15_000 })
}

test.describe('Reception + OPD onboarding', () => {
  test('full reception workflow with screenshots and video', async ({ page }) => {
    test.setTimeout(180_000)
    await login(page)

    const screens: [string, string][] = [
      ['Patient Search', '02-patient-search'],
      ['OPD Check-In', '03-opd-checkin'],
      ['Appointments', '04-appointments'],
      ['Referrals', '05-referrals'],
      ['Sick Sheets', '06-sick-sheets'],
      ['Medical Documents', '07-medical-documents'],
      ['Triage Queue', '08-triage-queue'],
      ['Doctor Queue', '09-doctor-queue'],
      ['Register Patient', '10-register-patient'],
    ]

    for (const [label, file] of screens) {
      await openNav(page, label)
      await shot(page, file)
    }
  })
})
