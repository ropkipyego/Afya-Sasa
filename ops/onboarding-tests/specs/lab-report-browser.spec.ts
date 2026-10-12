import { test, expect } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const OUT = path.join(__dirname, '..', 'results', 'lab-e2e-output', 'screenshots')
fs.mkdirSync(OUT, { recursive: true })

test('structured report distinguishes flags and escapes patient text', async ({ page }) => {
  await page.setContent(`<!DOCTYPE html><html><body>
    <h1>Jalaram St. Christopher Hospital</h1>
    <p>Laboratory report · SYN-RPT-1 · Status: verified</p>
    <p>&lt;script&gt;x&lt;/script&gt; Synthetic · SYN-24001</p>
    <p class="unassessed">Unassessed means no applicable approved reference interval was used. It is not a normal result.</p>
    <table>
      <tr class="flag-critical"><td>Synthetic CBC</td><td>WBC</td><td>0.4</td><td>Critical low</td></tr>
      <tr class="flag-normal"><td>Synthetic CBC</td><td>HGB</td><td>13</td><td>Normal</td></tr>
      <tr class="flag-abnormal"><td>Synthetic CBC</td><td>PLT</td><td>20</td><td>Low</td></tr>
    </table>
  </body></html>`)
  await page.screenshot({ path: path.join(OUT, 'report-flags.png'), fullPage: true })
  await expect(page.locator('body')).toContainText('Critical low')
  await expect(page.locator('body')).toContainText('Normal')
  await expect(page.locator('body')).toContainText('Low')
  const html = await page.content()
  expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
  expect(html).not.toMatch(/<script>x<\/script>/)
})

test('unassessed is not presented as complete or normal', async ({ page }) => {
  await page.setContent(`<!DOCTYPE html><html><body>
    <div class="incomplete">Incomplete panel — not a complete report. missing HGB</div>
    <p>Unassessed means no applicable approved reference interval was used. It is not a normal result.</p>
    <td>No reference interval</td>
    <td class="comment">line one
line two</td>
  </body></html>`)
  await page.screenshot({ path: path.join(OUT, 'report-unassessed-incomplete.png'), fullPage: true })
  await expect(page.locator('body')).toContainText('No reference interval')
  await expect(page.locator('body')).toContainText('Incomplete panel')
  await expect(page.locator('body')).toContainText('line one')
})
