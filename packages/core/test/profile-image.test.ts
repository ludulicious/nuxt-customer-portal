import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import sharp from 'sharp'
import { prepareProfileImage, profileImageUrl, ProfileImageError } from '../server/utils/profile-image'
import { PROFILE_IMAGE_INPUT_LIMIT, PROFILE_IMAGE_SIZE, PROFILE_IMAGE_STORED_LIMIT } from '../shared/profile-image'

const origin = 'https://portal.example.test'
const dataUrl = (bytes: Buffer, type = 'png') => `data:image/${type};base64,${bytes.toString('base64')}`

test('large profile uploads are stored as bounded WebP and metadata is stripped', async () => {
  const input = await sharp(randomBytes(640 * 640 * 3), { raw: { width: 640, height: 640, channels: 3 } })
    .png()
    .toBuffer()
  const source = dataUrl(input)
  assert.ok(source.length > 1_000_000)
  const normalized = (await prepareProfileImage(source))!
  const bytes = Buffer.from(normalized.split(',')[1]!, 'base64')
  const metadata = await sharp(bytes).metadata()
  assert.match(normalized, /^data:image\/webp;base64,/)
  assert.ok(bytes.length <= PROFILE_IMAGE_STORED_LIMIT)
  assert.ok(metadata.width! <= PROFILE_IMAGE_SIZE && metadata.height! <= PROFILE_IMAGE_SIZE)
  assert.equal(metadata.exif, undefined)
  assert.ok(normalized.length < 44_000)
  assert.ok(source.length > 1_000_000, 'the input is not mutated')
})

test('complex transparent images obey the stored-byte cap and small images are not enlarged', async () => {
  const noise = await sharp(randomBytes(256 * 256 * 4), { raw: { width: 256, height: 256, channels: 4 } })
    .png()
    .toBuffer()
  const result = (await prepareProfileImage(dataUrl(noise)))!
  const bytes = Buffer.from(result.split(',')[1]!, 'base64')
  assert.ok(bytes.length <= PROFILE_IMAGE_STORED_LIMIT)
  assert.equal((await sharp(bytes).metadata()).hasAlpha, true)
  const small = await sharp({ create: { width: 24, height: 12, channels: 3, background: '#123456' } })
    .png()
    .toBuffer()
  const resized = Buffer.from((await prepareProfileImage(dataUrl(small)))!.split(',')[1]!, 'base64')
  assert.equal((await sharp(resized).metadata()).width, 24)
  assert.equal((await sharp(resized).metadata()).height, 12)
})

test('profile orientation is applied before resizing', async () => {
  const input = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#123456' } })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer()
  const result = (await prepareProfileImage(dataUrl(input, 'jpeg')))!
  const metadata = await sharp(Buffer.from(result.split(',')[1]!, 'base64')).metadata()
  assert.equal(metadata.width, 128)
  assert.equal(metadata.height, 256)
  assert.equal(metadata.orientation, undefined)
})

test('existing photos become small absolute session references for the portal and connected websites', () => {
  const source = 'data:image/png;base64,' + 'A'.repeat(1_205_646)
  const image = profileImageUrl('person', source, origin)!
  assert.match(image, /^https:\/\/portal\.example\.test\/api\/portal\/images\/user\/person\/avatar\?v=[a-f0-9]{24}$/)
  assert.ok(JSON.stringify({ user: { id: 'person', image } }).length < 250)
  assert.notEqual(image, profileImageUrl('person', source + 'A', origin))
  assert.equal(profileImageUrl('person', null, origin), null)
  assert.equal(
    profileImageUrl('person', 'https://social.example.test/avatar.png', origin),
    'https://social.example.test/avatar.png'
  )
})

test('profile writes omit unchanged/stale own avatar references and allow removal', async () => {
  const url = profileImageUrl('person', 'data:image/png;base64,AAAA', origin)!
  assert.equal(await prepareProfileImage(url, 'person', origin), undefined)
  assert.equal(
    await prepareProfileImage('/api/portal/images/user/person/avatar?v=' + 'b'.repeat(24), 'person', origin),
    undefined
  )
  assert.equal(await prepareProfileImage(undefined, 'person', origin), undefined)
  assert.equal(await prepareProfileImage(null, 'person', origin), null)
  assert.equal(await prepareProfileImage('', 'person', origin), null)
  assert.equal(
    await prepareProfileImage('https://social.example.test/photo.png', 'person', origin),
    'https://social.example.test/photo.png'
  )
  await assert.rejects(prepareProfileImage(url, 'other-person', origin), ProfileImageError)
  await assert.rejects(prepareProfileImage(url.replace(/v=.*/, 'v=invalid'), 'person', origin), ProfileImageError)
})

test('invalid images and excessive uploads cannot be saved', async () => {
  for (const value of [
    'blob:invalid',
    'javascript:alert(1)',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'data:image/png;base64,AAAA',
    '/photo.png'
  ]) {
    await assert.rejects(
      prepareProfileImage(value, 'person', origin),
      (error: unknown) => error instanceof ProfileImageError && error.code === 'PROFILE_IMAGE_INVALID'
    )
  }
  await assert.rejects(
    prepareProfileImage(dataUrl(Buffer.alloc(PROFILE_IMAGE_INPUT_LIMIT + 1))),
    (error: unknown) => error instanceof ProfileImageError && error.code === 'PROFILE_IMAGE_TOO_LARGE'
  )
})
