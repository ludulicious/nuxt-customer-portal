import assert from 'node:assert/strict'
import test from 'node:test'
import { storageExtension } from '../shared/storage'

test('stored product files use canonical extensions for every accepted content type', () => {
  assert.deepEqual(
    [
      'application/pdf',
      'application/zip',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/ogg',
      'video/mp4',
      'video/webm',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif'
    ].map(storageExtension),
    ['pdf', 'zip', 'mp3', 'm4a', 'wav', 'ogg', 'mp4', 'webm', 'txt', 'docx', 'jpg', 'png', 'webp', 'avif']
  )
})
