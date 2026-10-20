import assert from 'node:assert/strict'
import test from 'node:test'
import { renderEmailTemplate, validateEmailTemplateSyntax } from '../shared/email-template'
import {
  renderPortalEmailMarkdown,
  validatePortalEmailText,
  validatePortalEmailTemplate
} from '../server/utils/portal-email'
import { purchaseConfirmationEmail } from '../../products/shared/emails'
import { downloadLinksMarkdown } from '../../products/shared/downloads'

const allowed = new Set(['downloads', 'product', 'url'])
const source =
  'Thank you!\n\n{{#if downloads}}You can download your audio files here:\n\n{{downloads}}{{else}}We will contact you soon.{{/if}}\n\nSee you soon.'

test('conditional email copy and links render only when downloads exist', () => {
  const files = [{ id: 'audio', name: 'Audio.mp3', url: 'https://portal.test/audio' }]
  const rendered = renderEmailTemplate(source, { downloads: downloadLinksMarkdown(files) }, allowed)
  const html = renderPortalEmailMarkdown(rendered)
  assert.match(html, /You can download your audio files here:/)
  assert.match(html, /<a href="https:\/\/portal.test\/audio">Audio.mp3<\/a>/)
  assert.doesNotMatch(html, /We will contact|{{/)
  for (const empty of ['', ' \n ']) {
    const withoutFiles = renderEmailTemplate(source, { downloads: empty }, allowed)
    assert.match(withoutFiles, /We will contact you soon/)
    assert.doesNotMatch(withoutFiles, /download your audio|Audio.mp3|{{/)
  }
  assert.equal(
    renderEmailTemplate('Before{{#if downloads}}Files{{/if}}After', { downloads: '' }, allowed),
    'BeforeAfter'
  )
})

test('nested conditions and independent blocks keep their own branches', () => {
  const template =
    '{{#if product}}P{{#if downloads}}D{{else}}N{{/if}}{{else}}X{{/if}}/{{#if downloads}}Y{{else}}Z{{/if}}'
  assert.equal(renderEmailTemplate(template, { product: 'Audio', downloads: 'files' }, allowed), 'PD/Y')
  assert.equal(renderEmailTemplate(template, { product: 'Audio', downloads: '' }, allowed), 'PN/Z')
  assert.equal(renderEmailTemplate(template, { product: '', downloads: 'files' }, allowed), 'X/Y')
})

test('replacement values remain literal and are never reinterpreted as template syntax', () => {
  const injected = '{{#if downloads}}injected{{/if}}'
  assert.equal(renderEmailTemplate('{{product}}', { product: injected }, allowed), injected)
  assert.equal(
    renderEmailTemplate('{{#if downloads}}{{product}}{{/if}}', { downloads: 'yes', product: injected }, allowed),
    injected
  )
})

test('malformed, unknown, and overly nested conditions fail validation', () => {
  for (const template of [
    '{{#if downloads}}unclosed',
    '{{else}}',
    '{{/if}}',
    '{{#if downloads}}yes{{else}}no{{else}}again{{/if}}',
    '{{#unless downloads}}no{{/unless}}',
    '{{#if downloads.length}}files{{/if}}',
    '{{#if downloads',
    '{{#if unknown}}files{{/if}}',
    '{{#if downloads}}{{else}}{{unknown}}{{/if}}',
    '{{#if downloads}}'.repeat(21) + '{{/if}}'.repeat(21)
  ]) {
    assert.throws(() => validateEmailTemplateSyntax(template, allowed), undefined, template)
  }
  assert.throws(
    () => renderEmailTemplate('{{#if downloads}}yes{{/if}}', {}, allowed),
    /Missing email placeholder value/
  )
})

test('server-side email validation checks condition names and block structure', () => {
  const definition = purchaseConfirmationEmail
  assert.doesNotThrow(() => validatePortalEmailText(definition, { ...definition.defaults.en, body: source }))
  assert.throws(
    () => validatePortalEmailText(definition, { ...definition.defaults.en, body: '{{#if missing}}hi{{/if}}' }),
    /Unknown purchase placeholder: missing/
  )
  assert.throws(
    () => validatePortalEmailText(definition, { ...definition.defaults.en, body: '{{#if downloads}}hi' }),
    /Missing {{\/if}}/
  )
  assert.doesNotThrow(() => validatePortalEmailTemplate('{{body}}{{#if footer}}<footer>{{footer}}</footer>{{/if}}'))
  assert.throws(
    () => validatePortalEmailTemplate('{{body}}{{#if downloads}}files{{/if}}'),
    /Unknown template placeholder: downloads/
  )
})

test('default purchase templates keep their localized heading only when files exist', () => {
  for (const locale of ['en', 'nl'] as const) {
    const template = purchaseConfirmationEmail.defaults[locale].body
    const keys = new Set(purchaseConfirmationEmail.placeholders.map((item) => item.key))
    const values = Object.fromEntries(purchaseConfirmationEmail.placeholders.map((item) => [item.key, item.example]))
    const withFiles = renderEmailTemplate(template, values, keys)
    const withoutFiles = renderEmailTemplate(template, { ...values, downloads: '' }, keys)
    const heading = locale === 'en' ? 'Download your files:' : 'Download je bestanden:'
    assert.ok(withFiles.includes(heading))
    assert.ok(!withoutFiles.includes(heading))
    assert.ok(!withFiles.includes('{{'))
    assert.ok(!withoutFiles.includes('{{'))
  }
})
