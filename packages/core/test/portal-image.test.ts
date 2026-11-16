import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import { portalImageThumbnail, portalImageUrl, portalImageVersion } from '../server/utils/portal-image'
import { createApp, eventHandler, toWebHandler } from 'h3'
import { portalImageResponse } from '../server/utils/portal-image-response'

test('embedded image URLs are small, versioned and preserve external images', () => {
  const large = 'data:image/png;base64,' + 'A'.repeat(1_205_646)
  const url = portalImageUrl('user', 'person/one', 'avatar', large)!
  assert.ok(url.length < 120)
  assert.match(url, /^\/api\/portal\/images\/user\/person%2Fone\/avatar\?v=[a-f0-9]{24}$/)
  assert.notEqual(url, portalImageUrl('user', 'person/one', 'avatar', large + 'A'))
  assert.equal(
    portalImageUrl('user', 'one', 'avatar', 'https://example.test/avatar.png'),
    'https://example.test/avatar.png'
  )
  assert.equal(portalImageUrl('user', 'one', 'avatar', null), null)
})

test('thumbnails resize and deduplicate concurrent requests without altering the original', async () => {
  const original = await sharp({ create: { width: 640, height: 320, channels: 4, background: '#2090aa' } })
    .png()
    .toBuffer()
  const source = `data:image/png;base64,${original.toString('base64')}`
  const version = portalImageVersion(source)
  const [first, second] = await Promise.all([portalImageThumbnail(source, 96), portalImageThumbnail(source, 96)])
  assert.strictEqual(first, second)
  assert.strictEqual(await portalImageThumbnail(source, 96), first)
  const metadata = await sharp(first).metadata()
  assert.equal(metadata.format, 'webp')
  assert.equal(metadata.width, 96)
  assert.equal(metadata.height, 48)
  assert.ok(first.length < original.length)
  const logo = await sharp(await portalImageThumbnail(source, 512)).metadata()
  assert.equal(logo.width, 512)
  assert.equal(portalImageVersion(source), version)
  assert.deepEqual(Buffer.from(source.split(',')[1]!, 'base64'), original)
})

test('invalid and oversized embedded images are rejected', async () => {
  await assert.rejects(portalImageThumbnail('https://example.test/image.png', 96), /Unsupported/)
  await assert.rejects(portalImageThumbnail('data:image/png;base64,not-an-image', 96))
  await assert.rejects(portalImageThumbnail('data:image/png;base64,' + 'A'.repeat(15 * 1024 * 1024), 96), /Unsupported/)
})

test('image responses cache privately, revalidate with ETags and reject stale versions', async () => {
  const input = await sharp({ create: { width: 160, height: 160, channels: 4, background: '#2090aa' } })
    .png()
    .toBuffer()
  let value = `data:image/png;base64,${input.toString('base64')}`
  const app = createApp({ onError: () => {} }).use(eventHandler((event) => portalImageResponse(event, value, 'avatar')))
  const request = toWebHandler(app)
  const url = `http://localhost${portalImageUrl('user', 'one', 'avatar', value)}`
  const response = await request(new Request(url))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'image/webp')
  assert.match(response.headers.get('cache-control')!, /^private, max-age=86400/)
  assert.equal(response.headers.get('vary'), 'Cookie')
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width, 96)
  const cached = await request(new Request(url, { headers: { 'if-none-match': response.headers.get('etag')! } }))
  assert.equal(cached.status, 304)
  assert.equal(await cached.text(), '')
  value += '\n'
  const stale = await request(new Request(url))
  assert.equal(stale.status, 404)
  assert.equal(stale.headers.get('cache-control'), 'private, no-store')
})

test('public branding thumbnails cache without cookies and preserve useful background resolution', async () => {
  const original = await sharp({ create: { width: 2000, height: 1200, channels: 3, background: '#2090aa' } })
    .png()
    .toBuffer()
  const value = `data:image/png;base64,${original.toString('base64')}`
  const app = createApp({ onError: () => {} }).use(
    eventHandler((event) => portalImageResponse(event, value, 'logo', { public: true, size: 1600 }))
  )
  const request = toWebHandler(app)
  const url = `http://localhost/api/portal/public/images/authBackgroundDesktop?v=${portalImageVersion(value)}`
  const response = await request(new Request(url))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control')!, /^public, max-age=86400, immutable$/)
  assert.equal(response.headers.get('vary'), null)
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata()
  assert.equal(metadata.width, 1600)
  assert.equal(metadata.height, 960)
  const cached = await request(new Request(url, { headers: { 'if-none-match': response.headers.get('etag')! } }))
  assert.equal(cached.status, 304)
})
