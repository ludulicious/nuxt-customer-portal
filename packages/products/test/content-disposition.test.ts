import assert from 'node:assert/strict'
import test from 'node:test'
import { assetContentDisposition } from '../shared/content-disposition'
import { withFileExtension } from '../shared/file-name'

test('localized purchase downloads retain the display name and original extension', () => {
  const name = withFileExtension("Shannon's discover yourself meditation", 'original.mp3')
  const header = assetContentDisposition(name, true)
  assert.match(header, /^attachment; filename="Shannon's discover yourself meditation.mp3";/)
  assert.equal(header.split("filename*=UTF-8''")[1], 'Shannon%27s%20discover%20yourself%20meditation.mp3')
})

test('Unicode filenames have a compatible ASCII fallback and an intact UTF-8 name', () => {
  const header = assetContentDisposition('Méditation – détente.mp3', true)
  assert.match(header, /filename="M_ditation _ d_tente.mp3"/)
  assert.equal(decodeURIComponent(header.split("filename*=UTF-8''")[1]!), 'Méditation – détente.mp3')
})

test('header names escape apostrophes and neutralize control characters and path separators', () => {
  const header = assetContentDisposition('Audio "one"/\\\r\n.mp3', true)
  assert.ok(!/[\r\n]/.test(header))
  assert.match(header, /filename="Audio _one_____.mp3"/)
  assert.match(
    assetContentDisposition("Audio's (one)*!.mp3", false),
    /filename\*=UTF-8''Audio%27s%20%28one%29%2A%21.mp3$/
  )
  assert.match(assetContentDisposition('Preview.mp3', false), /^inline;/)
})
