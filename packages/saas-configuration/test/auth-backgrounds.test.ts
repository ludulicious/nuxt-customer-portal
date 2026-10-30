import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import sharp from 'sharp'
import { defaultPortalSettings, portalSettingsSchema } from '../shared/settings'
import { validateBrandImages as validatePortalBrandImages } from '../server/utils/brand-images'

const fields = ['authBackgroundDesktop', 'authBackgroundMobile'] as const

test('legacy portal settings receive empty authentication backgrounds without changing logos', () => {
  const settings = defaultPortalSettings()
  const { authBackgroundDesktop: _desktop, authBackgroundMobile: _mobile, ...branding } = settings.branding
  branding.logoLight = 'data:image/png;base64,YQ=='
  const parsed = portalSettingsSchema.parse({ ...settings, branding })

  assert.equal(parsed.branding.authBackgroundDesktop, '')
  assert.equal(parsed.branding.authBackgroundMobile, '')
  assert.equal(parsed.branding.logoLight, branding.logoLight)
})

test('authentication background settings reject URLs, SVG, and oversized encoded images', () => {
  for (const field of fields) {
    for (const image of [
      'https://example.test/background.jpg',
      'data:image/svg+xml;base64,PHN2Zy8+',
      `data:image/png;base64,${'a'.repeat(2_800_001)}`
    ]) {
      const settings = defaultPortalSettings()
      settings.branding[field] = image
      assert.equal(portalSettingsSchema.safeParse(settings).success, false)
    }
  }
})

test('server validation accepts desktop and portrait backgrounds in supported raster formats', async () => {
  for (const format of ['png', 'jpeg', 'webp'] as const) {
    const settings = defaultPortalSettings()
    for (const field of fields) {
      const portrait = field === 'authBackgroundMobile'
      const image = await sharp({
        create: { width: portrait ? 900 : 1600, height: portrait ? 1600 : 900, channels: 3, background: '#ffffff' }
      })
        .toFormat(format)
        .toBuffer()
      settings.branding[field] = `data:image/${format};base64,${image.toString('base64')}`
    }
    await validatePortalBrandImages(portalSettingsSchema.parse(settings))
  }
})

test('server validation rejects corrupt, oversized, and non-raster backgrounds for both viewports', async () => {
  const tooWide = await sharp({ create: { width: 2401, height: 1, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer()
  const tooTall = await sharp({ create: { width: 1, height: 2401, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer()
  const fixtures = [
    { bytes: Buffer.from('not an image'), message: /not a valid image/ },
    { bytes: Buffer.alloc(2_000_001), message: /smaller than 2 MB/ },
    { bytes: tooWide, message: /dimensions must not exceed/ },
    { bytes: tooTall, message: /dimensions must not exceed/ },
    {
      bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),
      message: /not a valid image/
    }
  ]
  for (const field of fields) {
    for (const fixture of fixtures) {
      const settings = defaultPortalSettings()
      settings.branding[field] = `data:image/png;base64,${fixture.bytes.toString('base64')}`
      await assert.rejects(validatePortalBrandImages(settings), { statusCode: 400, message: fixture.message })
    }
  }
})

test('background validation retains existing compact-icon safeguards and accepts removed images', async () => {
  const settings = defaultPortalSettings()
  await validatePortalBrandImages(settings)
  const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer()
  settings.branding.markLight = `data:image/png;base64,${image.toString('base64')}`
  await assert.rejects(validatePortalBrandImages(settings), { statusCode: 400, message: /at least 64×64/ })
})

test('appearance settings expose independent background uploads, previews, and removal in both languages', async () => {
  const source = await readFile(new URL('../app/components/portal-settings/BrandingStep.vue', import.meta.url), 'utf8')
  assert.match(source, /fields: \['authBackgroundDesktop', 'authBackgroundMobile'\]/)
  assert.match(source, /:src="state\.branding\[field\]"/)
  assert.match(source, /:preview="false"/)
  assert.match(source, /readImage\(\$event, field\)/)
  assert.match(source, /removeImage\(field\)/)
  for (const locale of ['en', 'nl']) {
    const messages = JSON.parse(await readFile(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    const editor = messages.saasSettings.editor
    assert.ok(editor.authBackgroundSection)
    assert.ok(editor.authBackgroundDescription)
    for (const field of fields) {
      assert.ok(editor.fields[field])
      assert.ok(editor.assetDescriptions[field])
    }
  }
})
