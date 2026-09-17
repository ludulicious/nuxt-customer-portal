import assert from 'node:assert/strict'
import test from 'node:test'
import { cropSchema, settingsSchema, storageSettingsSchema } from '../shared/validation'

test('image policy defaults and bounds configured source dimensions', () => {
  const settings = settingsSchema.parse({ enabled: false, defaultLocale: 'en', languages: ['en'], currencies: ['EUR'] })
  assert.deepEqual(settings.imagePolicy, {
    thumbnail: { width: 400, height: 400 },
    gallery: { width: 800, height: 1000 },
    detail: { width: 1200, height: 900 }
  })
  assert.equal(
    settingsSchema.safeParse({
      ...settings,
      imagePolicy: { ...settings.imagePolicy, thumbnail: { width: 199, height: 400 } }
    }).success,
    false
  )
})

test('crop coordinates stay normalized and inside the decoded source', () => {
  assert.equal(cropSchema.safeParse({ x: 0.1, y: 0, width: 0.8, height: 1 }).success, true)
  assert.equal(cropSchema.safeParse({ x: 0.4, y: 0, width: 0.8, height: 1 }).success, false)
})

test('S3 settings validate endpoints and permit retaining stored credentials', () => {
  assert.equal(
    storageSettingsSchema.safeParse({
      endpoint: 'https://s3.example.test',
      region: 'eu-west-1',
      bucket: 'products',
      pathStyle: true
    }).success,
    true
  )
  assert.equal(
    storageSettingsSchema.safeParse({
      endpoint: 'javascript:alert(1)',
      region: 'eu-west-1',
      bucket: 'products',
      pathStyle: false
    }).success,
    false
  )
})

test('Bunny Storage uses its proprietary API endpoint without S3 credentials', () => {
  assert.equal(
    storageSettingsSchema.safeParse({
      provider: 'bunny',
      endpoint: 'https://storage.bunnycdn.com',
      region: '',
      bucket: 'products-zone',
      pathStyle: false
    }).success,
    true
  )
  assert.equal(
    storageSettingsSchema.safeParse({
      provider: 'bunny',
      endpoint: '',
      region: '',
      bucket: 'products-zone',
      pathStyle: false
    }).success,
    true
  )
})
