import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'

const sharp = createRequire(new URL('../../packages/products/package.json', import.meta.url))('sharp')
test.skip(!process.env.PORTAL_MEDIA_E2E, 'Requires the documented isolated media test portal')
const image = async (name: string) => ({
  name,
  mimeType: 'image/png',
  buffer: await sharp({ create: { width: 800, height: 600, channels: 3, background: '#669933' } })
    .png()
    .toBuffer()
})
test.beforeEach(async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: 'cookie-consent', value: 'accepted', url: baseURL! }])
  const login = await page.request.post('/api/auth/sign-in/email', {
    timeout: 20000,
    data: { email: 'media-owner@example.test', password: 'Media-test-password-2026!' }
  })
  expect(login.ok(), await login.text()).toBeTruthy()
  const active = await page.request.post('/api/auth/organization/set-active', {
    timeout: 20000,
    data: { organizationId: 'media-store' }
  })
  expect(active.ok(), await active.text()).toBeTruthy()
})
test('single upload, adjustments, independent thumbnail, metadata, reset, dirty guard and responsive library', async ({
  page
}, testInfo) => {
  const title = `Browser forest ${Date.now()}`
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('/admin/products/media/upload')
  await expect(page.getByRole('heading', { name: 'Upload image', exact: true })).toBeVisible()
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles(await image('forest.png'))
  await page.getByRole('textbox', { name: /^Title/ }).fill(title)
  await page.getByRole('textbox', { name: /^Description/ }).fill('A green forest in daylight')
  await page.getByRole('tab', { name: 'Adjust image', exact: true }).click()
  await page.getByRole('button', { name: 'Rotate right', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  const brightness = page.getByRole('group', { name: 'Brightness', exact: true }).getByRole('slider')
  await brightness.focus()
  await brightness.press('ArrowRight')
  await page.getByRole('tab', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /^Title/ })).toHaveValue(title)
  await page.getByRole('button', { name: 'Add thumbnail', exact: true }).click()
  await page.getByRole('group', { name: 'Zoom', exact: true }).getByRole('slider').focus()
  await page.getByRole('group', { name: 'Zoom', exact: true }).getByRole('slider').press('ArrowRight')
  await page.getByRole('button', { name: 'Crop image', exact: true }).click()
  await page.getByRole('tab', { name: 'Details', exact: true }).click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes · All changes saved', exact: true })).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('editor-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Back to library', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Media library', exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  await page.getByRole('tab', { name: 'Adjust image', exact: true }).click()
  await page.getByRole('button', { name: 'Reset to original', exact: true }).click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes · All changes saved', exact: true })).toBeDisabled()
  await page.getByRole('textbox', { name: /^Title/ }).fill('Unsaved forest')
  await page.getByRole('button', { name: 'Back to library', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Unsaved changes' })).toBeVisible()
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /^Title/ })).toHaveValue('Unsaved forest')
  await page.getByRole('button', { name: 'Back to library', exact: true }).click()
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Media library', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  const heading = await page.getByRole('heading', { name: 'Media library', exact: true }).boundingBox()
  const upload = await page.getByRole('button', { name: 'Upload image', exact: true }).boundingBox()
  expect(heading!.y + heading!.height).toBeLessThanOrEqual(upload!.y)
  await page.screenshot({ path: testInfo.outputPath('library-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: `Edit ${title}`, exact: true }).click()
  await expect(page.getByRole('textbox', { name: /^Title/ })).toHaveValue(title)
  await expect(page.getByRole('tab', { name: 'Adjust image', exact: true })).toBeEnabled()
  await page.screenshot({ path: testInfo.outputPath('editor-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  expect(errors).toEqual([])
})
test('batch review preserves individual edits and retries failed saves without duplicates', async ({ page }) => {
  const batchTag = `batch-${Date.now()}`
  await page.goto('/admin/products/media/upload?batch=1')
  await page
    .locator('input[type=file]')
    .first()
    .setInputFiles([await image(`${batchTag}-one.png`), await image(`${batchTag}-two.png`)])
  await page.getByRole('button', { name: 'Review 2 images', exact: true }).click()
  await page.getByRole('textbox', { name: /^Title/ }).fill(`${batchTag} first`)
  await page.getByRole('textbox', { name: /^Description/ }).fill('First batch description')
  await page.getByRole('button', { name: `2. ${batchTag}-two.png`, exact: true }).click()
  await page.getByRole('textbox', { name: /^Title/ }).fill(`${batchTag} second`)
  await page.getByRole('textbox', { name: /^Description/ }).fill('Second batch description')
  await page.getByRole('button', { name: `1. ${batchTag}-one.png`, exact: true }).click()
  await expect(page.getByRole('textbox', { name: /^Description/ })).toHaveValue('First batch description')
  let fail = true
  await page.route('**/api/products/media/uploads/*/complete', async (route) => {
    if (fail) {
      fail = false
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Try again' })
      })
    } else {
      await route.continue()
    }
  })
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByText('Image storage is unavailable. Try again.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /^Description/ })).toHaveValue('Second batch description')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'All images saved', exact: true })).toBeVisible()
  const list = await (await page.request.get(`/api/products/media?search=${batchTag}`)).json()
  expect(list.items).toHaveLength(2)
})

test('API keys reach scoped media authentication through the full portal middleware', async ({
  page,
  playwright,
  baseURL
}) => {
  const key = async (scope: string) => {
    const response = await page.request.post('/api/admin/api-keys', {
      data: { name: 'Media browser test', scopes: [scope] }
    })
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json()).key as string
  }
  const read = await key('products.media:read'),
    manage = await key('products.media:manage')
  const anonymous = await playwright.request.newContext({ baseURL })
  try {
    expect((await anonymous.get('/api/products/media')).status()).toBe(401)
    expect(
      (await anonymous.get('/api/products/media', { headers: { Authorization: `Bearer ${read}` } })).status()
    ).toBe(200)
    expect(
      (
        await anonymous.post('/api/products/media/uploads', { headers: { Authorization: `Bearer ${read}` }, data: {} })
      ).status()
    ).toBe(403)
    expect(
      (
        await anonymous.post('/api/products/media/uploads', {
          headers: { Authorization: `Bearer ${manage}` },
          data: {}
        })
      ).status()
    ).toBe(400)
  } finally {
    await anonymous.dispose()
  }
})

test('library preserves search state, supports keyboard ordering and confirms deletion', async ({ page }) => {
  const tag = `Library ${Date.now()}`
  const create = async (title: string) => {
    const file = await image('library.png')
    const started = await page.request.post('/api/products/media/uploads', {
      data: { files: [{ role: 'original', name: file.name, contentType: file.mimeType, size: file.buffer.length }] }
    })
    expect(started.ok()).toBeTruthy()
    const upload = await started.json()
    expect(
      (
        await page.request.put(upload.files[0].url, { data: file.buffer, headers: { 'Content-Type': file.mimeType } })
      ).ok()
    ).toBeTruthy()
    const completed = await page.request.post(`/api/products/media/uploads/${upload.id}/complete`, {
      data: { title, alt: title, categories: ['E2E library'], credit: '', visible: true }
    })
    expect(completed.ok()).toBeTruthy()
    return completed.json()
  }
  const a = await create(`${tag} A`),
    b = await create(`${tag} B`)
  const first = (await (await page.request.get('/api/products/media')).json()).items[0]
  expect(
    (
      await page.request.put('/api/products/media/reorder', {
        data: { id: a.id, beforeId: first.id, revision: a.revision }
      })
    ).ok()
  ).toBeTruthy()
  const latestB = await (await page.request.get(`/api/products/media/${b.id}`)).json()
  expect(
    (
      await page.request.put('/api/products/media/reorder', {
        data: { id: b.id, beforeId: a.id, revision: latestB.revision }
      })
    ).ok()
  ).toBeTruthy()
  await page.goto('/admin/products/media')
  await expect(page.locator('article').first()).toContainText(b.title)
  const card = page.locator('article').filter({ hasText: a.title })
  await card.getByRole('button', { name: 'Move earlier', exact: true }).focus()
  await card.getByRole('button', { name: 'Move earlier', exact: true }).press('Enter')
  await expect(page.locator('article').first()).toContainText(a.title)
  await page.locator('article').first().getByRole('button', { name: 'Preview image', exact: true }).click()
  const preview = page.getByRole('dialog', { name: a.title, exact: true })
  await expect(preview.getByRole('img', { name: a.title, exact: true })).toBeVisible()
  await preview.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByPlaceholder('Search images…').fill(b.title)
  await expect(page.locator('article')).toHaveCount(1)
  await expect(page).toHaveURL(/search=/)
  await page.reload()
  await expect(page.getByPlaceholder('Search images…')).toHaveValue(b.title)
  await page.locator('article').getByRole('button', { name: 'Delete image', exact: true }).click()
  const confirmation = page.getByRole('dialog', { name: 'Delete image', exact: true })
  expect((await page.request.get(`/api/products/media/${b.id}`)).status()).toBe(200)
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await page.request.get(`/api/products/media/${b.id}`)).status()).toBe(200)
  await page.locator('article').getByRole('button', { name: 'Delete image', exact: true }).click()
  await confirmation.getByRole('button', { name: 'Delete image', exact: true }).click()
  await expect(page.locator('article')).toHaveCount(0)
  expect((await page.request.get(`/api/products/media/${b.id}`)).status()).toBe(404)
})
