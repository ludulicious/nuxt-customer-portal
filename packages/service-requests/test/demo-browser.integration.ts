import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

// Run against an already seeded local demo. Only the temporary request is mutated.
const baseURL = process.env.DEMO_TEST_URL || 'http://localhost:3051'
assert.equal(new URL(baseURL).hostname, 'localhost')
const browser = await chromium.launch()
const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } })
await context.addCookies([{ name: 'cookie-consent', value: 'accepted', url: baseURL }])
const page = await context.newPage()
page.setDefaultTimeout(15000)
const errors: string[] = []
page.on('pageerror', (error) => errors.push(error.message))
let createdId: string | undefined
try {
  for (const path of ['/requests', '/admin/requests']) {
    await page.goto(path)
    const cards = page.locator('.service-request-list-scroll a')
    await expect(cards).toHaveCount(20)
    const secondPage = page.locator('footer button').filter({ hasText: /^2$/ })
    await secondPage.click()
    await expect(page).toHaveURL(/page=2/)
    await expect(cards).toHaveCount(16)
    await page.reload()
    await expect(cards).toHaveCount(16)
    await expect(page).toHaveURL(/page=2/)
    await page.getByRole('button', { name: 'Load previous requests' }).click()
    await expect(cards).toHaveCount(36)
    const links = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')))
    assert.equal(new Set(links).size, 36, 'Prepending does not duplicate cards')
    await page.getByPlaceholder('Search requests…').fill('onboarding')
    await expect(page).not.toHaveURL(/page=2/)
    await expect(cards).toHaveCount(12)
    await page.reload()
    await expect(page.getByPlaceholder('Search requests…')).toHaveValue('onboarding')
    await expect(cards).toHaveCount(12)
    await page.getByRole('combobox', { name: 'Filter by status' }).click()
    await page.getByRole('option', { name: 'Resolved', exact: true }).click()
    await expect(page).toHaveURL(/status=RESOLVED/)
    await expect(cards).toHaveCount(8)
    await page.getByRole('combobox', { name: 'Sort by', exact: true }).click()
    await page.getByRole('option', { name: 'Priority', exact: true }).click()
    await expect(page).toHaveURL(/sortBy=priority/)
    await cards.first().click()
    await page.getByRole('heading', { name: 'Update the onboarding screens', exact: true, level: 1 }).waitFor()
    await page.getByRole('link', { name: 'Back to requests' }).click()
    await expect(page).toHaveURL(/status=RESOLVED/)
    await expect(page).toHaveURL(/sortBy=priority/)
    await page.getByPlaceholder('Search requests…').fill('no-such-request-903241')
    await expect(page.getByText('No matching requests', { exact: true })).toBeVisible()
  }
  await page.goto('/requests')
  const scroller = page.locator('.service-request-list-scroll')
  await expect(scroller.locator('a')).toHaveCount(20)
  await scroller.evaluate((node) => {
    node.scrollTop = node.scrollHeight
  })
  await expect(scroller.locator('a')).toHaveCount(36)

  await page.goto('/requests/new')
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByText('Enter a title between 3 and 200 characters.')).toBeVisible()
  await expect(page.getByText('Enter a description between 10 and 5,000 characters.')).toBeVisible()
  await expect(page.getByText('Select a client.', { exact: true })).toBeVisible()
  const title = `Request polish check ${Date.now()}`
  await page.getByPlaceholder('Title', { exact: true }).fill(title)
  await page
    .getByPlaceholder('Description', { exact: true })
    .fill('Temporary request for validating the service request workflow.')
  await page.getByRole('combobox', { name: /^Client/ }).click()
  await page.getByRole('option', { name: 'Greenhouse Collective', exact: true }).click()
  const created = page.waitForResponse(
    (response) => response.url().endsWith('/api/service-requests') && response.request().method() === 'POST'
  )
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  const response = await created
  assert.equal(response.status(), 200)
  createdId = (await response.json()).id
  await page.waitForURL('**/requests')
  await page.getByRole('heading', { name: title, exact: true }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog').getByPlaceholder('Title', { exact: true }).fill(`${title} edited`)
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('heading', { name: `${title} edited`, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete Request', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  assert.equal((await context.request.get(`/api/service-requests/${createdId}`)).status(), 200)

  await page.goto(`/admin/requests/${createdId}`)
  await page.getByRole('combobox', { name: 'Status', exact: true }).click()
  await page.getByRole('option', { name: 'In Progress', exact: true }).click()
  await page.getByRole('combobox', { name: 'Assigned to', exact: true }).click()
  await page.getByRole('option', { name: 'Jamie Chen', exact: true }).click()
  await page.getByRole('textbox', { name: 'Internal notes', exact: true }).fill('Temporary internal test note')
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/service-requests/admin/${createdId}`) && response.request().method() === 'PATCH'
  )
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  assert.equal((await saved).status(), 200)
  const record = await (await context.request.get(`/api/service-requests/${createdId}`)).json()
  assert.equal(record.status, 'IN_PROGRESS')
  assert.equal(record.assignedToId, 'demo-member')
  const foreign = await context.request.patch(`/api/service-requests/admin/${createdId}`, {
    data: { assignedToId: 'demo-client-owner' }
  })
  assert.equal(foreign.status(), 400, 'Client users cannot be assigned as provider team members')

  for (const path of ['/requests', '/admin/requests']) {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(path)
    await page.locator('.service-request-list-scroll h2').first().waitFor()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    const footer = await page.locator('footer').last().boundingBox()
    assert.ok(footer && footer.y + footer.height <= 845, 'Pagination remains in the viewport')
    await page.getByRole('button', { name: 'Filters', exact: true }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
  }
  await context.addCookies([{ name: 'i18n_redirected', value: 'nl', url: baseURL }])
  await page.goto('/requests/new')
  await page.getByRole('button', { name: 'Aanmaken', exact: true }).click()
  await expect(page.getByText('Voer een titel van 3 tot 200 tekens in.')).toBeVisible()
  await context.addCookies([{ name: 'i18n_redirected', value: 'en', url: baseURL }])
  await page.goto(`/requests/${createdId}`)
  await page.getByRole('button', { name: 'Delete Request', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await page.waitForURL('**/requests')
  assert.equal((await context.request.get(`/api/service-requests/${createdId}`)).status(), 404)
  createdId = undefined
  assert.deepEqual(errors, [], 'No browser runtime errors')
  console.log(
    'Service requests: customer/admin pagination, filters, sorting, detail return, create/edit/admin update, deletion cancel, mobile layout and Dutch validation passed.'
  )
} catch (error) {
  await page.screenshot({ path: '/private/tmp/service-requests-test-failure.png' })
  console.log('Browser errors:', errors)
  throw error
} finally {
  if (createdId) {
    await context.request.delete(`/api/service-requests/${createdId}`)
  }
  await browser.close()
}
