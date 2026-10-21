import assert from 'node:assert/strict'
import test from 'node:test'
import { renderDescription } from '../server/utils/markdown'
import {
  purchaseThankYouVariant,
  thankYouCopySchema,
  saveThankYouSchema,
  resolveThankYouCopy,
  type ThankYouText
} from '../shared/thank-you'

test('thank-you variants follow the order amount, including expired free offers and invoiced orders', () => {
  assert.equal(purchaseThankYouVariant({ total: 0, lines: [{ unit_amount: 0 }] }), 'free')
  assert.equal(purchaseThankYouVariant({ total: 1200, lines: [{ unit_amount: 1000 }] }), 'paid')
  assert.equal(purchaseThankYouVariant({ total: null, lines: [{ unit_amount: 0 }] }), 'free')
  assert.equal(purchaseThankYouVariant({ total: null, lines: [] }), 'paid')
  assert.equal(purchaseThankYouVariant({ total: null, lines: [{ unit_amount: 0 }, { unit_amount: 1000 }] }), 'paid')
})

test('editable thank-you copy is bounded plain text with all required fields', () => {
  const copy = {
    statusLabel: 'Ready',
    heading: 'Your gift',
    message: 'Welcome\nEnjoy your gift.',
    helpText: '',
    downloadsHeading: 'Downloads'
  }
  assert.equal(thankYouCopySchema.safeParse(copy).success, true)
  assert.equal(thankYouCopySchema.safeParse({ ...copy, message: 'x'.repeat(4001) }).success, false)
  assert.equal(thankYouCopySchema.safeParse({ heading: 'Incomplete' }).success, false)
})

test('localized defaults and per-product overrides inherit blank fields without crossing variants', () => {
  const entries: ThankYouText[] = [
    { productSlug: '', locale: 'en', variant: 'free', copy: { heading: 'Free default', message: 'Welcome' } },
    { productSlug: '', locale: 'en', variant: 'paid', copy: { heading: 'Paid default' } },
    { productSlug: 'audio', locale: 'en', variant: 'free', copy: { heading: 'Your audio is ready', message: '  ' } }
  ]
  assert.equal(resolveThankYouCopy(entries, 'audio', 'free', 'en').heading, 'Your audio is ready')
  assert.equal(resolveThankYouCopy(entries, 'audio', 'free', 'en').message, 'Welcome')
  assert.equal(resolveThankYouCopy(entries, 'audio', 'paid', 'en').heading, 'Paid default')
  assert.equal(resolveThankYouCopy(entries, 'other', 'free', 'en').heading, 'Free default')
  assert.equal(resolveThankYouCopy(entries, 'audio', 'free', 'nl').heading, 'Je cadeau staat voor je klaar')
})

test('text saves accept partial copy, reject unknown fields and bound the scope', () => {
  assert.equal(
    saveThankYouSchema.safeParse({ locale: 'en', variant: 'free', copy: { heading: 'Personal welcome' } }).success,
    true
  )
  assert.equal(
    saveThankYouSchema.safeParse({ productSlug: 'x'.repeat(201), locale: 'en', variant: 'free', copy: {} }).success,
    false
  )
  assert.equal(
    saveThankYouSchema.safeParse({ locale: 'en', variant: 'free', copy: { purchaseUrl: 'https://example.test' } })
      .success,
    false
  )
  assert.equal(saveThankYouSchema.safeParse({ locale: 'de', variant: 'free', copy: {} }).success, false)
})

test('combined Markdown inherits as one field and preserves legacy copy', () => {
  const entries: ThankYouText[] = [
    { productSlug: '', locale: 'en', variant: 'free', copy: { content: '# Welcome\n\nEnjoy **your gift**.' } },
    { productSlug: 'audio', locale: 'en', variant: 'free', copy: { content: '  ' } }
  ]
  assert.equal(resolveThankYouCopy(entries, 'audio', 'free', 'en').content, '# Welcome\n\nEnjoy **your gift**.')
  entries[1]!.copy.content = '# Your audio\n\n[Next steps](https://example.com)'
  assert.match(resolveThankYouCopy(entries, 'audio', 'free', 'en').content!, /^# Your audio/)
  assert.doesNotMatch(resolveThankYouCopy(entries, 'audio', 'paid', 'en').content!, /Your audio|your gift/)
  const legacy = resolveThankYouCopy(
    [
      {
        productSlug: 'audio',
        locale: 'en',
        variant: 'free',
        copy: { heading: 'Old heading', message: '<script>unsafe</script>' }
      }
    ],
    'audio',
    'free',
    'en'
  )
  assert.match(legacy.content!, /^# Old heading/)
  assert.match(renderDescription(legacy.content!), /&lt;script&gt;/)
})

test('thank-you Markdown renders formatting and strips executable content', () => {
  const html = renderDescription(
    '# Welcome\n\nEnjoy **your gift**.\n\n- One\n- Two\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1)) <img src=x onerror=alert(1)>'
  )
  assert.match(html, /<h1>Welcome<\/h1>/)
  assert.match(html, /<strong>your gift<\/strong>/)
  assert.match(html, /<ul>/)
  assert.doesNotMatch(html, /<script|javascript:|onerror|<img/)
  assert.equal(
    saveThankYouSchema.safeParse({ locale: 'en', variant: 'free', copy: { content: 'x'.repeat(12001) } }).success,
    false
  )
})
