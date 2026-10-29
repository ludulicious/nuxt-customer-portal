import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { emptyProduct } from '../../packages/products/shared/validation'

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
  await page.getByRole('button', { name: /^Thumbnail/ }).click()
  await page.getByRole('tab', { name: 'Adjust image', exact: true }).click()
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

test('store presets apply on the next save and custom variants stay independent', async ({ page }) => {
  const configuration = await (await page.request.get('/api/products/media/presets')).json()
  expect(
    (
      await page.request.put('/api/products/media/presets', {
        data: {
          revision: configuration.revision,
          presets: [
            { key: 'thumbnail', label: 'Thumbnail', width: 400, height: 400 },
            { key: 'gallery', label: 'Gallery', width: 800, height: 1000 },
            { key: 'detail', label: 'Detail', width: 1200, height: 900 }
          ]
        }
      })
    ).ok()
  ).toBeTruthy()
  const title = `Variant workflow ${Date.now()}`
  const file = await image('variants.png')
  const started = await (
    await page.request.post('/api/products/media/uploads', {
      data: { files: [{ role: 'original', name: file.name, contentType: file.mimeType, size: file.buffer.length }] }
    })
  ).json()
  expect(
    (
      await page.request.put(started.files[0].url, { data: file.buffer, headers: { 'Content-Type': file.mimeType } })
    ).ok()
  ).toBeTruthy()
  const createdResponse = await page.request.post(`/api/products/media/uploads/${started.id}/complete`, {
    data: { title, alt: title, categories: [], credit: '', visible: true }
  })
  expect(createdResponse.ok(), await createdResponse.text()).toBeTruthy()
  const created = await createdResponse.json()
  expect(Object.keys(created.variants).sort()).toEqual(['detail', 'gallery', 'thumbnail'])
  expect(created.variants.thumbnail.mode).toBe('automatic')
  expect(created.thumbnail.width).toBe(400)
  const policy = (await (await page.request.get('/api/products/admin/settings')).json()).imagePolicy
  await page.goto(`/admin/products/media/${created.id}`)
  await page.getByRole('button', { name: /^Gallery/ }).click()
  await page.getByRole('tab', { name: 'Adjust image', exact: true }).click()
  const zoom = page.getByRole('group', { name: 'Zoom', exact: true }).getByRole('slider')
  await zoom.focus()
  await zoom.press('ArrowRight')
  await page.getByRole('button', { name: 'Crop image', exact: true }).click()
  await page.getByRole('button', { name: /^Detail/ }).click()
  await page.getByRole('button', { name: /^Gallery/ }).click()
  await expect(page.getByRole('button', { name: /^Gallery/ })).toContainText('Custom')
  await page.getByRole('tab', { name: 'Details', exact: true }).click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes · All changes saved', exact: true })).toBeDisabled()
  const custom = await (await page.request.get(`/api/products/media/${created.id}`)).json()
  expect(custom.variants.gallery.mode).toBe('custom')
  const customBytes = await (await page.request.get(custom.variants.gallery.file.url)).body()
  expect(await (await page.request.get(custom.image.url)).body()).toEqual(file.buffer)
  await page.goto('/admin/products/settings/media')
  await page.getByRole('button', { name: 'Add variant', exact: true }).click()
  const key = page.getByRole('textbox', { name: /^Key/ }).last()
  await key.fill('thumbnail')
  await page.getByRole('textbox', { name: /^Name/ }).last().fill('Social')
  await page
    .getByRole('spinbutton', { name: /^Width/ })
    .last()
    .fill('640')
  await page
    .getByRole('spinbutton', { name: /^Width/ })
    .last()
    .press('Tab')
  await page
    .getByRole('spinbutton', { name: /^Height/ })
    .last()
    .fill('320')
  await page
    .getByRole('spinbutton', { name: /^Height/ })
    .last()
    .press('Tab')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.getByText('Use unique variant keys and keep the required thumbnail variant.', { exact: true })
  ).toBeVisible()
  await key.fill('social')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.getByText('Variant settings saved. Existing images will update when each image is next saved.', {
      exact: true
    })
  ).toBeVisible()
  const unchanged = await (await page.request.get(`/api/products/media/${created.id}`)).json()
  expect(unchanged.variants.social).toBeUndefined()
  expect(unchanged.variantsOutdated).toBe(true)
  expect(await (await page.request.get(unchanged.variants.gallery.file.url)).body()).toEqual(customBytes)
  expect((await (await page.request.get('/api/products/admin/settings')).json()).imagePolicy).toEqual(policy)
  await page.goto(`/admin/products/media/${created.id}`)
  await expect(
    page.getByText('Variant settings have changed. Save this image to generate the current variants.', { exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: /^Social/ }).click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes · All changes saved', exact: true })).toBeDisabled()
  const updated = await (await page.request.get(`/api/products/media/${created.id}`)).json()
  expect(updated.variants.social.file.width).toBe(640)
  expect(updated.variants.social.file.height).toBe(320)
  expect(updated.variantsOutdated).toBe(false)
  expect(updated.variants.gallery.mode).toBe('custom')
  expect(await (await page.request.get(updated.variants.gallery.file.url)).body()).toEqual(customBytes)
  await page.getByRole('button', { name: /^Gallery/ }).click()
  await page.getByRole('button', { name: 'Reset to automatic', exact: true }).click()
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save changes · All changes saved', exact: true })).toBeDisabled()
  expect((await (await page.request.get(`/api/products/media/${created.id}`)).json()).variants.gallery.mode).toBe(
    'automatic'
  )
})

test('products select library variants, preserve ordering and publish only linked content', async ({
  page,
  playwright,
  baseURL
}, testInfo) => {
  const title = `Product media ${Date.now()}`
  const file = await image('product-library.png')
  const upload = await (
    await page.request.post('/api/products/media/uploads', {
      data: { files: [{ role: 'original', name: file.name, contentType: file.mimeType, size: file.buffer.length }] }
    })
  ).json()
  expect(
    (
      await page.request.put(upload.files[0].url, { data: file.buffer, headers: { 'Content-Type': file.mimeType } })
    ).ok()
  ).toBeTruthy()
  const media = await (
    await page.request.post(`/api/products/media/uploads/${upload.id}/complete`, {
      data: { title, alt: 'Product library photo', categories: ['Products'], credit: '', visible: true }
    })
  ).json()
  const category = await (
    await page.request.post('/api/products/admin/categories', {
      data: {
        code: `media-${Date.now()}`,
        content: { en: { name: title, description: '' }, nl: { name: title, description: '' } }
      }
    })
  ).json()
  const body = {
    ...emptyProduct(),
    slug: `product-media-${Date.now()}`,
    categoryId: category.id,
    type: 'service',
    isFree: true,
    prices: [],
    content: {
      en: { title, summary: 'Summary', description: 'Description' },
      nl: { title, summary: 'Samenvatting', description: 'Beschrijving' }
    }
  }
  const response = await page.request.post('/api/products/admin/products', { data: body })
  expect(response.ok(), await response.text()).toBeTruthy()
  const product = await response.json()
  await page.goto(`/admin/products/${product.id}/images`)
  await expect(page.getByRole('button', { name: 'Choose from media library', exact: true })).toBeVisible()
  await expect(page.locator('input[type=file]')).toHaveCount(0)
  for (const [purpose, variant] of [
    ['Thumbnail', 'Thumbnail'],
    ['Product card / gallery', 'Gallery'],
    ['Product detail', 'Detail']
  ]) {
    await page.getByRole('tab', { name: new RegExp(`^${purpose}`) }).click()
    await page.getByRole('button', { name: 'Choose from media library', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Choose from media library', exact: true })
    await dialog.getByRole('textbox').first().fill(title)
    await dialog.getByRole('button', { name: `Select ${title}`, exact: true }).click()
    await expect(dialog.getByRole('combobox').last()).toContainText(variant!)
    await dialog.getByRole('button', { name: 'Use image', exact: true }).click()
    await expect(dialog).not.toBeVisible()
  }
  await page.getByRole('tab', { name: /^Product card \/ gallery/ }).click()
  await page.getByRole('button', { name: 'Choose from media library', exact: true }).click()
  const picker = page.getByRole('dialog', { name: 'Choose from media library', exact: true })
  await picker.getByRole('textbox').first().fill(title)
  await picker.getByRole('button', { name: `Select ${title}`, exact: true }).click()
  await picker.getByRole('combobox').last().click()
  await page.getByRole('option', { name: 'Full image', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('product-library-picker-desktop.png'), fullPage: true })
  await picker.getByRole('button', { name: 'Use image', exact: true }).click()
  await page.getByRole('button', { name: 'Earlier', exact: true }).click()
  const committed = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/products/admin/products/${product.id}`) && response.request().method() === 'PUT'
  )
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const commit = await committed
  expect(commit.ok(), await commit.text()).toBeTruthy()
  await expect(page.getByRole('button', { name: 'Choose from media library', exact: true })).toBeVisible()
  let saved = (await (await page.request.get(`/api/products/admin/products/${product.id}/preview`)).json()).product
  expect(saved.imageIds).toHaveLength(4)
  expect(saved.galleryImageIds).toHaveLength(2)
  const assets = await (await page.request.get(`/api/products/admin/products/${product.id}/assets`)).json()
  expect(assets.every((asset: { media_id: string }) => asset.media_id === media.id)).toBeTruthy()
  expect(assets.find((asset: { id: string }) => asset.id === saved.galleryImageIds[0]).media_variant).toBe('image')
  const presets = await (await page.request.get('/api/products/media/presets')).json()
  expect(
    (
      await page.request.put('/api/products/media/presets', {
        data: { ...presets, presets: presets.presets.filter((preset: { key: string }) => preset.key !== 'gallery') }
      })
    ).status()
  ).toBe(409)
  expect(
    (
      await page.request.post(`/api/products/admin/products/${product.id}/uploads`, { data: { visibility: 'public' } })
    ).status()
  ).toBe(400)
  expect(
    (await page.request.delete(`/api/products/media/${media.id}`, { data: { revision: media.revision } })).status()
  ).toBe(409)
  const anonymous = await playwright.request.newContext({ baseURL })
  try {
    expect((await anonymous.get(`/api/products/media/${media.id}/content`)).status()).toBe(401)
    expect((await anonymous.get(`/api/store/media/${saved.thumbnailImageId}`)).status()).toBe(404)
    const published = await page.request.put(`/api/products/admin/products/${product.id}`, {
      data: { ...saved, status: 'published' }
    })
    expect(published.ok(), await published.text()).toBeTruthy()
    saved = await published.json()
    const delivered = await anonymous.get(`/api/store/media/${saved.thumbnailImageId}`)
    expect(delivered.ok(), await delivered.text()).toBeTruthy()
    expect(delivered.headers().location).toBeUndefined()
    expect(await delivered.body()).toEqual(await (await page.request.get(media.thumbnail.url)).body())
    const hidden = await page.request.put('/api/products/media', { data: { ...media, visible: false } })
    expect(hidden.ok(), await hidden.text()).toBeTruthy()
    expect((await anonymous.get(`/api/store/media/${saved.thumbnailImageId}`)).status()).toBe(404)
    expect(
      (await page.request.get(`/api/products/admin/products/${product.id}/images/${saved.thumbnailImageId}`)).status()
    ).toBe(200)
    const latest = await hidden.json()
    expect((await page.request.put('/api/products/media', { data: { ...latest, visible: true } })).ok()).toBeTruthy()
  } finally {
    await anonymous.dispose()
  }
  await page.goto(`/admin/products/${product.id}/images`)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Choose from media library', exact: true }).click()
  await page
    .getByRole('dialog', { name: 'Choose from media library', exact: true })
    .getByRole('textbox')
    .first()
    .fill(title)
  await expect(page.getByRole('button', { name: `Select ${title}`, exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('product-library-mobile.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})
