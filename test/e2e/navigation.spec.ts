import { test, expect } from '@playwright/test'

test.skip(!process.env.PORTAL_NAVIGATION_E2E, 'Requires the isolated media test portal and navigation member fixture')
const signIn = async (page: import('@playwright/test').Page, baseURL: string, email = 'media-owner@example.test') => {
  await page.context().addCookies([{ name: 'cookie-consent', value: 'accepted', url: baseURL }])
  const login = await page.request.post('/api/auth/sign-in/email', {
    data: { email, password: 'Media-test-password-2026!' }
  })
  expect(login.ok(), await login.text()).toBeTruthy()
  expect(
    (await page.request.post('/api/auth/organization/set-active', { data: { organizationId: 'media-store' } })).ok()
  ).toBeTruthy()
  await page.goto('/dashboard')
  await expect(page.locator('[data-portal-sidebar]')).toBeVisible()
}

test('expanded sidebar, bottom collapse control, active page and complete search', async ({
  page,
  baseURL
}, testInfo) => {
  await signIn(page, baseURL!)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  const sidebar = page.locator('[data-portal-sidebar]')
  await expect(sidebar.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible()
  await sidebar.getByRole('button', { name: 'Store', exact: true }).click()
  await expect(sidebar.getByRole('link', { name: 'Media library', exact: true })).toBeVisible()
  await sidebar.getByRole('link', { name: 'Media library', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/products\/media$/)
  await expect(sidebar.getByRole('link', { name: 'Media library', exact: true })).toHaveAttribute(
    'aria-current',
    'page'
  )
  const collapse = await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).boundingBox()
  expect(collapse!.y).toBeGreaterThan(page.viewportSize()!.height - 80)
  await page.screenshot({ path: testInfo.outputPath('expanded-desktop.png') })
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  const search = page.getByRole('dialog').getByRole('textbox')
  await search.fill('Media')
  await expect(page.getByRole('option').filter({ hasText: 'Media library' })).toBeVisible()
  await search.fill('Store settings')
  await expect(page.getByRole('option').filter({ hasText: 'Store settings' })).toBeVisible()
  await search.fill('Users')
  await expect(page.getByRole('option').filter({ hasText: 'Users' })).toBeVisible()
  await search.fill('Store')
  await expect(page.getByRole('option').filter({ hasText: 'Media library' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press(
    (await page.evaluate(() => navigator.userAgent.includes('Macintosh;'))) ? 'Meta+k' : 'Control+k'
  )
  await expect(page.getByRole('dialog').getByRole('textbox')).toBeFocused()
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
})

test('collapsed flyouts support pointer and keyboard, and preserve the rail after navigation', async ({
  page,
  baseURL
}, testInfo) => {
  await signIn(page, baseURL!)
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click()
  await expect(
    page.locator('[data-portal-sidebar]').getByRole('link', { name: 'Dashboard', exact: true })
  ).toBeVisible()
  const store = page.locator('[data-portal-sidebar]').getByRole('button', { name: 'Store', exact: true })
  await store.hover()
  const flyout = page.locator('[data-module="products"]')
  await expect(flyout.getByRole('link', { name: 'Media library', exact: true })).toBeVisible()
  await page.mouse.move(900, 80)
  await expect(flyout).not.toBeVisible()
  await store.focus()
  await store.press('ArrowDown')
  await expect(flyout.getByRole('link').first()).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('collapsed-flyout.png'), animations: 'disabled' })
  await page.keyboard.press('Escape')
  await expect(flyout).not.toBeVisible()
  await expect(store).toBeFocused()
  await store.click()
  await flyout.getByRole('link', { name: 'Media library', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/products\/media$/)
  await expect(flyout).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible()
})

test('mobile menu contains module children and search at narrow widths', async ({ page, baseURL }, testInfo) => {
  await signIn(page, baseURL!)
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 844 })
    await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    const menu = page.getByRole('dialog')
    await menu.getByRole('button', { name: 'Store', exact: true }).click()
    await expect(menu.getByRole('link', { name: 'Media library', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    await page.screenshot({ path: testInfo.outputPath(`menu-${width}.png`) })
    if (width === 320) {
      await menu.getByRole('button', { name: 'Search', exact: true }).click()
      await page.getByRole('dialog').getByRole('textbox').fill('Media')
      await page.getByRole('option').filter({ hasText: 'Media library' }).click()
    } else {
      await menu.getByRole('link', { name: 'Media library', exact: true }).click()
    }
    await expect(menu).not.toBeVisible()
    await page.goto('/dashboard')
  }
})

test('provider members do not see management-only modules or search results', async ({ page, baseURL }) => {
  await signIn(page, baseURL!, 'navigation-member@example.test')
  const sidebar = page.locator('[data-portal-sidebar]')
  await expect(sidebar.getByRole('button', { name: 'Store', exact: true })).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: 'Admin', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Search', exact: true }).click()
  await page.getByRole('dialog').getByRole('textbox').fill('Media')
  await expect(page.getByRole('option').filter({ hasText: 'Media library' })).toHaveCount(0)
  await page.getByRole('dialog').getByRole('textbox').fill('Users')
  await expect(page.getByRole('option').filter({ hasText: 'Users' })).toHaveCount(0)
})
