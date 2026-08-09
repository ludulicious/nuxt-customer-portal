import { expect, test } from '@playwright/test'

test('the public demos expose structurally distinct host shells', async ({ page }, testInfo) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()

  if (testInfo.project.name.startsWith('apex')) {
    await expect(page.locator('.public-home')).toBeVisible()
    await expect(page.locator('.brutal-home')).toHaveCount(0)
  } else {
    await expect(page.locator('.brutal-shell')).toBeVisible()
    await expect(page.locator('.brutal-home')).toBeVisible()
    await expect(page.getByText('ONE CORE.', { exact: false })).toBeVisible()
    await expect(page.locator('.public-home')).toHaveCount(0)
  }

  await page.screenshot({ path: testInfo.outputPath('shell.png'), fullPage: true })
})

test('authentication routes remain available in every shell', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.locator('form')).toBeVisible()
})
