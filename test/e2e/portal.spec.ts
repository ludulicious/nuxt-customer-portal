import { expect, test } from '@playwright/test'
import { defaultPortalSettings } from '../../packages/saas-configuration/shared/settings'

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: 'cookie-consent', value: 'accepted', url: baseURL! }])
})

test('normal portal supports sign-in and onboarding without demo access', async ({ page }, info) => {
  test.skip(info.project.name.startsWith('demo'))
  await page.goto('/login')
  await expect(page.locator('form')).toBeVisible()
  await expect(page.locator('[data-demo-banner]')).toHaveCount(0)
  await page.getByRole('textbox', { name: /^Email/ }).fill('owner@example.test')
  await page.getByLabel(/^Password/).fill('Portal-e2e-password-2026!')
  await page.locator('form button[type=submit]').click()
  await expect(page).toHaveURL(/\/(onboarding|dashboard)$/)
  const bootstrap = await (await page.request.get('/api/portal/bootstrap')).json()
  if (!bootstrap.completed) {
    await expect(page.locator('form')).toBeVisible()
    const complete = await page.request.post('/api/admin/portal-settings/complete', {
      data: { settings: defaultPortalSettings('Test Portal') }
    })
    expect(complete.ok(), await complete.text()).toBeTruthy()
    await page.goto('/dashboard')
  }
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('main')).toBeVisible()
  expect((await page.request.get('/api/demo/users')).status()).toBe(404)
  expect((await page.request.post('/api/demo/switch', { data: { userId: 'demo-admin' } })).status()).toBe(404)
  await page.goto('/admin/portal-settings')
  await expect(page.locator('form')).toBeVisible()
  await expect(page.locator('form button[type=submit]')).toBeEnabled()
  await page.getByRole('textbox', { name: /^Portal name/ }).fill('Test Portal Verified')
  const saved = page.waitForResponse(
    (response) => response.url().endsWith('/api/admin/portal-settings') && response.request().method() === 'PUT'
  )
  await page.locator('form button[type=submit]').click()
  expect((await saved).status()).toBe(200)
  await page.reload()
  await expect(page.getByRole('textbox', { name: /^Portal name/ })).toHaveValue('Test Portal Verified')
  await page.screenshot({ path: info.outputPath('normal-settings.png'), fullPage: true })
})

test('demo exposes seeded workflows, role switching and read-only settings', async ({ page }, info) => {
  test.skip(!info.project.name.startsWith('demo'))
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('[data-demo-banner]')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Explore as' })).toBeVisible()
  await page.goto('/login')
  await expect(page).toHaveURL(/\/dashboard$/)
  expect((await (await page.request.get('/api/portal/bootstrap')).json()).completed).toBe(true)
  for (const path of [
    '/admin/timesheets',
    '/admin/invoices',
    '/admin/requests',
    '/admin/products',
    '/admin/planning'
  ]) {
    await page.goto(path)
    await expect(page).toHaveURL(new RegExp(path + '$'))
    await expect(page.locator('main')).toBeVisible()
    await expect(page.getByText('500', { exact: true })).toHaveCount(0)
  }
  await page.goto('/admin/portal-settings')
  await expect(page.getByText('Demo settings are read-only.', { exact: false })).toBeVisible()
  await expect(page.locator('form button[type=submit]')).toBeDisabled()
  await expect(page.getByRole('textbox', { name: /^Portal name/ })).toBeDisabled()
  const rejected = await page.request.put('/api/admin/portal-settings', { data: {} })
  expect(rejected.status()).toBe(403)
  expect((await rejected.json()).data.code).toBe('DEMO_RESTRICTED')
  await page.screenshot({ path: info.outputPath('demo-settings.png'), fullPage: true })
  const identities = await (await page.request.get('/api/demo/users')).json()
  expect(identities).toHaveLength(7)
  for (const identity of identities) {
    expect((await page.request.post('/api/demo/switch', { data: { userId: identity.id } })).ok()).toBeTruthy()
    const session = await (await page.request.get('/api/auth/get-session')).json()
    expect(session.user.id).toBe(identity.id)
  }
  await page.goto('/dashboard')
  await expect(page.locator('[data-demo-banner]')).toBeVisible()
  await page.getByRole('combobox', { name: 'Explore as' }).click()
  await page.getByRole('option').filter({ hasText: 'Alex Morgan' }).click()
  await expect(page.getByRole('combobox', { name: 'Explore as' })).toContainText('Alex Morgan')
  await page.screenshot({ path: info.outputPath('demo-dashboard.png'), fullPage: true })
  expect(errors).toEqual([])
})
