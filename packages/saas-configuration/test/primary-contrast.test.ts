import assert from 'node:assert/strict'
import test from 'node:test'
import { primaryForeground } from '../shared/primary-contrast'

test('primary foreground adapts to dark and light brand colors', () => {
  assert.equal(primaryForeground('#d6004a'), '#ffffff')
  assert.equal(primaryForeground('#D6004A'), '#ffffff')
  assert.equal(primaryForeground('#000000'), '#ffffff')
  assert.equal(primaryForeground('#ffffff'), '#000000')
  assert.equal(primaryForeground('#fb923c'), '#000000')
  assert.equal(primaryForeground('#ffff00'), '#000000')
})

test('selected foreground maintains at least 4.5:1 contrast across sampled sRGB colors', () => {
  const linear = (value: number) => {
    const channel = value / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  }
  for (let r = 0; r <= 255; r += 17) {
    for (let g = 0; g <= 255; g += 17) {
      for (let b = 0; b <= 255; b += 17) {
        const hex = '#' + [r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')
        const luminance = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
        const ratio = primaryForeground(hex) === '#ffffff' ? 1.05 / (luminance + 0.05) : (luminance + 0.05) / 0.05
        assert.ok(ratio >= 4.5, hex)
      }
    }
  }
})
