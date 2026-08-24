import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const viewportWidths = [320, 375, 414, 768]

test.describe('marketing homepage', () => {
  test('presents accessible product and contributor journeys at supported widths', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/', { waitUntil: 'networkidle' })

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Build your portal, layer by layer.')
    await expect(page.getByRole('heading', { name: 'A working week, end to end.' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Help shape the portal.' })).toBeVisible()
    await expect(page.getByRole('note', { name: 'Open-source license' })).toContainText(
      'open source under the MIT License'
    )
    await expect(page.getByRole('link', { name: 'Read compatibility and release status' })).toHaveAttribute(
      'href',
      '/reference/compatibility-and-releases'
    )
    await expect(page.getByRole('link', { name: 'Create a feature layer' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Improve the documentation' })).toBeVisible()

    await page.getByRole('button', { name: 'Search…' }).click()
    const searchDialog = page.getByRole('dialog', { name: 'Search documentation' })
    await expect(searchDialog).toBeVisible()
    await expect(page.getByText('Search Customer Portal documentation or navigate to a section.')).toBeVisible()
    await expect(searchDialog.getByRole('listbox', { name: 'Documentation search results' })).toBeVisible()
    await page.waitForTimeout(250)

    const searchAccessibility = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
    expect(searchAccessibility.violations).toEqual([])

    await page.getByRole('button', { name: 'Close' }).click()
    await expect(searchDialog).toBeHidden()

    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])

    await page.getByRole('button', { name: /Switch to (dark|light) mode/ }).click()
    const alternateThemeResults = await new AxeBuilder({ page }).analyze()
    expect(alternateThemeResults.violations).toEqual([])

    for (const width of viewportWidths) {
      await page.setViewportSize({ width, height: 900 })

      const viewport = await page.evaluate(() => ({
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth
      }))

      expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.innerWidth)
      await expect(page.getByTestId('hero-get-started')).toBeVisible()
      await expect(page.getByTestId('hero-demo')).toBeVisible()
      await expect(page.getByTestId('hero-github')).toBeVisible()
    }
  })
})
