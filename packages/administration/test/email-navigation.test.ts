import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { administrationFeature } from '../shared/feature'

test('email texts have a standalone menu entry and provider/template contribute settings tabs', () => {
  const menu = administrationFeature.modules?.find((item) => item.id === 'admin')?.menuItems
  const email = menu?.find((item) => item.id === 'admin-email')
  assert.equal(email?.to, '/admin/email-texts')
  assert.equal(email?.labelKey, 'admin.email.textPage')
  const tabs = administrationFeature.surfaces?.filter((item) => item.surface === 'administration.portal-settings')
  assert.deepEqual(
    tabs?.map((item) => item.id),
    ['email-provider', 'email-template']
  )
  assert.deepEqual(
    tabs?.map((item) => item.component),
    ['AdminEmailProviderSettings', 'AdminEmailTemplateSettings']
  )
})

test('standalone email texts retain the editor without provider/template navigation', async () => {
  const page = await readFile(new URL('../app/pages/admin/email-texts.vue', import.meta.url), 'utf8')
  assert.match(page, /useAdminEmailSettings\(\)/)
  assert.match(page, /<EmailTextSection/)
  assert.doesNotMatch(page, /<nav|EmailProviderSection|EmailTemplateSection/)
  const settings = await readFile(new URL('../app/composables/useAdminEmailSettings.ts', import.meta.url), 'utf8')
  assert.match(settings, /if \(!isAdmin.value\)/)
  assert.match(settings, /statusCode: 403/)
})

test('contributed email settings components are globally registered for dynamic resolution', async () => {
  for (const section of ['Provider', 'Template']) {
    const component = await readFile(
      new URL(`../app/components/admin/Email${section}Settings.global.vue`, import.meta.url),
      'utf8'
    )
    assert.match(component, /useAdminEmailSettings\(\)/)
    assert.ok(component.includes(`<Email${section}Section`))
  }
})

test('legacy email routes redirect to their corresponding new locations', async () => {
  const index = await readFile(new URL('../app/pages/admin/email/index.vue', import.meta.url), 'utf8')
  const section = await readFile(new URL('../app/pages/admin/email/[section].vue', import.meta.url), 'utf8')
  assert.match(index, /\/admin\/portal-settings\?settingsTab=email-provider/)
  assert.match(section, /provider: '\/admin\/portal-settings\?settingsTab=email-provider'/)
  assert.match(section, /template: '\/admin\/portal-settings\?settingsTab=email-template'/)
  assert.match(section, /text: '\/admin\/email-texts'/)
})

test('settings contributions stay outside the portal settings form and onboarding', async () => {
  const editor = await readFile(
    new URL('../../saas-configuration/app/components/PortalSettingsEditor.vue', import.meta.url),
    'utf8'
  )
  assert.match(editor, /props.onboarding \? undefined : settingsSections.value.find/)
  assert.match(editor, /contributionsFor\('administration.portal-settings'\)/)
  assert.match(editor, /<PortalSettingsContribution[\s\S]*?<UForm\s+v-else/)
  assert.match(editor, /:key="activeSettingsSection.id"/)
})

test('email text page labels are translated in English and Dutch', async () => {
  for (const [locale, label] of [
    ['en', 'Email Texts'],
    ['nl', 'E-mailteksten']
  ]) {
    const messages = JSON.parse(await readFile(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
    assert.equal(messages.admin.email.textPage, label)
    assert.ok(messages.admin.email.textDescription)
  }
})
