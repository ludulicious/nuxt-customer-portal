import assert from 'node:assert/strict'
import test from 'node:test'
import { purchaseMedia, publicOrderPath } from '../shared/purchase-media'
import { purchaseConfirmationEmail } from '../shared/emails'
import { renderEmailTemplate } from '../../core/shared/email-template'

test('YouTube share, watch, short, live and embed URLs become trusted privacy-enhanced embeds', () => {
  for (const url of [
    'https://youtu.be/dQw4w9WgXcQ?si=tracking',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=ignored',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://youtube.com/live/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
  ]) {
    assert.deepEqual(purchaseMedia(url), { kind: 'embed', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' })
  }
  assert.equal(
    purchaseMedia('https://youtu.be/dQw4w9WgXcQ?t=60')?.url,
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=60'
  )
})

test('Vimeo preserves public and unlisted video identities without forwarding arbitrary parameters', () => {
  assert.deepEqual(purchaseMedia('https://vimeo.com/123456789'), {
    kind: 'embed',
    url: 'https://player.vimeo.com/video/123456789'
  })
  for (const url of [
    'https://vimeo.com/123456789/abcdef1234',
    'https://player.vimeo.com/video/123456789?h=abcdef1234&autoplay=1'
  ]) {
    assert.equal(purchaseMedia(url)?.url, 'https://player.vimeo.com/video/123456789?h=abcdef1234')
  }
})

test('direct media URLs retain signed queries while ordinary or unsafe URLs never become frames', () => {
  assert.deepEqual(purchaseMedia('https://cdn.example.test/audio.MP3?signature=secret'), {
    kind: 'audio',
    url: 'https://cdn.example.test/audio.MP3?signature=secret'
  })
  assert.equal(purchaseMedia('https://cdn.example.test/video.webm')?.kind, 'video')
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,hi',
    '//youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://user:password@youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/embed/invalid',
    'https://vimeo.com/channels/test',
    'https://docs.google.com/document/d/example',
    'not a URL'
  ]) {
    assert.equal(purchaseMedia(url), undefined, url)
  }
})

test('purchase confirmations provide an account-free order link without changing the portal placeholder', () => {
  assert.equal(publicOrderPath('a'.repeat(64)), `/store/orders/${'a'.repeat(64)}`)
  const keys = new Set(purchaseConfirmationEmail.placeholders.map((item) => item.key))
  assert.ok(keys.has('url'))
  assert.ok(keys.has('orderUrl'))
  for (const locale of ['en', 'nl'] as const) {
    const email = renderEmailTemplate(
      purchaseConfirmationEmail.defaults[locale].body,
      {
        product: 'Audio',
        recipient_name: 'Alex',
        bookingReference: 'BK-TEST',
        instructions: '',
        downloads: '',
        url: 'https://portal.test/login',
        orderUrl: 'https://portal.test/store/orders/private'
      },
      keys
    )
    assert.match(email, /https:\/\/portal.test\/store\/orders\/private/)
    assert.doesNotMatch(email, /https:\/\/portal.test\/login/)
  }
})
