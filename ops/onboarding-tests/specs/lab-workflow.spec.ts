import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { installLabMockApi, syntheticLabStore } from './lab-mock-api'

const OUT = path.join(__dirname, '..', 'results', 'lab-e2e-output', 'screenshots')
fs.mkdirSync(OUT, { recursive: true })

async function blockLiveStack(page: import('@playwright/test').Page) {
  await page.route('**/socket.io/**', (route) => route.abort())
  await page.route(/:(8080|3000|5433)\b/, (route) => {
    throw new Error(`Laboratory UAT attempted to reach a live-stack URL: ${route.request().url()}`)
  })
}

async function login(page: import('@playwright/test').Page, email: string) {
  await page.addInitScript(() => {
    sessionStorage.setItem('afyasasa.activeScreen', 'Laboratory')
  })
  await page.goto('/')
  await expect(page.getByLabel(/^email$/i)).toBeVisible({ timeout: 30_000 })
  await page.getByLabel(/^email$/i).fill(email)
  await page.locator('input[type="password"]').first().fill('synthetic-password')
  const loginResponse = page.waitForResponse(
    (response) => response.url().includes('/auth/login') && response.request().method() === 'POST',
    { timeout: 15_000 },
  )
  await page.getByRole('button', { name: /^sign in$/i }).click()
  const response = await loginResponse
  expect(response.status(), await response.text()).toBe(200)
  await expect(page.getByRole('button', { name: /^sign in$/i })).toHaveCount(0)
  const menu = page.getByRole('button', { name: /open menu/i })
  if (await menu.isVisible().catch(() => false)) {
    await menu.click()
  }
  await expect(page.locator('nav').getByRole('button', { name: /^laboratory$/i }).first()).toBeVisible({
    timeout: 15_000,
  })
}

async function openLaboratory(page: import('@playwright/test').Page) {
  const nav = page.locator('aside nav')
  const group = nav.getByRole('button', { name: /^laboratory$/i }).first()
  if ((await group.getAttribute('aria-expanded')) === 'false') {
    await group.click()
  }
  await nav.getByRole('button', { name: 'Laboratory', exact: true }).last().click()
  await expect(page.getByText('Laboratory Information System')).toBeVisible({ timeout: 15_000 })
}

test.describe.configure({ mode: 'serial' })

test('synthetic laboratory browser workflow on isolated Vite', async ({ page }) => {
  await blockLiveStack(page)
  const harness = await installLabMockApi(page)
  await login(page, harness.users.lab.email)
  await page.screenshot({ path: path.join(OUT, '01-login.png'), fullPage: true })

  await openLaboratory(page)
  await page.getByRole('button', { name: /^worklist$/i }).click()
  await expect(page.getByText('Synthetic Patient')).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: path.join(OUT, '02-worklist.png'), fullPage: true })

  await page.getByRole('button', { name: /new request/i }).click()
  await expect(page.getByText(/search and select a patient/i)).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: path.join(OUT, '02b-new-request.png'), fullPage: true })
  await page.getByRole('button', { name: /close order form/i }).click()

  await page.getByText('Synthetic Patient').first().click()
  await expect(page.getByText('Request workspace')).toBeVisible({ timeout: 10_000 })

  const scan = page.getByPlaceholder(/scan label/i).last()
  await scan.fill('SYN-SMP-2')
  await scan.press('Enter')
  await expect(page.getByText(/different lab request|patient was not changed/i)).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('Synthetic Patient').first()).toBeVisible()
  await page.screenshot({ path: path.join(OUT, '03-barcode-identity.png'), fullPage: true })

  await page.locator('select[name="condition"]').selectOption('haemolysed')
  await page.locator('input[name="rejectionReason"]').fill('Gross haemolysis — synthetic')
  await page.getByRole('button', { name: /record receipt/i }).click()
  await expect(page.getByText(/specimen rejected/i)).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: path.join(OUT, '04-reject.png'), fullPage: true })

  await page.locator('select[name="condition"]').selectOption('adequate')
  await page.getByRole('button', { name: /record receipt/i }).click()
  await expect(page.getByText(/specimen received/i)).toBeVisible({ timeout: 10_000 })

  await page.getByRole('button', { name: /^close$/i }).click()
  await page.getByRole('button', { name: /result entry/i }).click()
  await page.getByText('Synthetic Patient').first().click()
  await expect(page.getByLabel(/white cells/i)).toBeVisible({ timeout: 10_000 })

  await page.getByLabel(/white cells/i).fill('0.4')
  await expect(page.getByText(/critically low|critical/i).first()).toBeVisible({ timeout: 10_000 })
  await page.getByLabel(/white cells/i).fill('7.2')
  await page.getByLabel(/haemoglobin/i).fill('13.1')
  await expect(page.getByText('No reference interval', { exact: true })).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: path.join(OUT, '05-result-entry.png'), fullPage: true })

  await page.getByLabel(/haemoglobin/i).fill('')
  await page.getByRole('button', { name: /save panel/i }).click()
  await expect(page.getByText(/panel results saved/i)).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: /verify/i }).first().click()
  await expect(page.getByText(/missing: HGB|structured results are required/i)).toBeVisible({
    timeout: 10_000,
  })

  await page.getByLabel(/haemoglobin/i).fill('13.1')
  await page.getByRole('button', { name: /update panel|save panel/i }).click()
  await page.getByRole('button', { name: /verify/i }).first().click()
  await expect(page.getByText(/verified|doctor notified/i)).toBeVisible({ timeout: 10_000 })
  await page.screenshot({ path: path.join(OUT, '06-verify.png'), fullPage: true })

  await expect(page.getByRole('button', { name: /amend/i })).toHaveCount(0)
})

test('cancellation and report access are denied without the exact permission', async ({ page }) => {
  await blockLiveStack(page)
  const harness = syntheticLabStore()
  harness.store.request.status = 'verified'
  await installLabMockApi(page, harness)
  await login(page, harness.users.outsider.email)
  await openLaboratory(page)
  await page.getByRole('button', { name: /^worklist$/i }).click()
  await page.getByText('Synthetic Patient').first().click()
  await page.screenshot({ path: path.join(OUT, '07-outsider-workspace.png'), fullPage: true })
  await expect(page.getByRole('button', { name: /cancel with reason/i })).toHaveCount(0)
  await page.getByRole('button', { name: /print structured report/i }).click()
  await expect(page.getByText('Report unavailable')).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Structured laboratory reports are limited')).toBeVisible()

  const denied = await page.evaluate(async () => {
    const response = await fetch('/api/v1/laboratory/results/res-0/amend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'synthetic' }),
    })
    return { status: response.status, body: await response.json() }
  })
  expect(denied.status).toBe(403)
})
