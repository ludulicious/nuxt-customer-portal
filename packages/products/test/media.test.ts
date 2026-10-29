import assert from 'node:assert/strict'
import test from 'node:test'
import { mediaDetailsSchema, mediaListSchema, mediaUploadSchema, mediaSaveSchema, mediaMaximum } from '../shared/media'
import {
  cropFrame,
  cropPixels,
  defaultAdjustments,
  imageGeometry,
  transformCrop,
  adjustBrightness,
  prepareImage
} from '../app/utils/media-image-processing'

test('media metadata is required, trimmed and deduplicated independently of product categories', () => {
  assert.deepEqual(
    mediaDetailsSchema.parse({
      title: ' Photo ',
      alt: ' A landscape ',
      categories: [' Nature ', 'Nature'],
      credit: ' Photographer '
    }),
    { title: 'Photo', alt: 'A landscape', categories: ['Nature'], credit: 'Photographer', visible: true }
  )
  assert.equal(mediaDetailsSchema.safeParse({ title: ' ', alt: ' ', categories: [] }).success, false)
  assert.equal(
    mediaSaveSchema.safeParse({
      id: 'f35c93be-cec4-49fb-a978-e81df0906ac1',
      title: 'Photo',
      alt: 'Landscape',
      categories: []
    }).success,
    false
  )
  assert.equal(
    mediaUploadSchema.safeParse({ files: [{ role: 'original', name: 'x.svg', contentType: 'image/svg+xml', size: 1 }] })
      .success,
    false
  )
  assert.equal(
    mediaUploadSchema.safeParse({
      files: [{ role: 'original', name: 'x.png', contentType: 'image/png', size: mediaMaximum + 1 }]
    }).success,
    false
  )
  assert.equal(
    mediaUploadSchema.safeParse({
      files: Array(2).fill({ role: 'original', name: 'x.png', contentType: 'image/png', size: 1 })
    }).success,
    false
  )
  assert.equal(mediaListSchema.parse({}).sortBy, 'order')
})
test('Studio crop geometry remains inside source pixels at every supported shape and rotation', () => {
  for (const [width, height] of [
    [4032, 3024],
    [600, 1200]
  ]) {
    for (const rotation of [0, 90, 180, 270]) {
      for (const straighten of [-15, 0, 15]) {
        const geometry = imageGeometry(width!, height!, { ...defaultAdjustments(), rotation, straighten })
        for (const ratio of [1, 4 / 3, 16 / 9, 3 / 4]) {
          const crop = cropFrame(geometry.width, geometry.height, ratio, 200, 100, 0)
          assert.ok(crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1.000001 && crop.y + crop.height <= 1.000001)
          const pixels = cropPixels(crop, geometry.width, geometry.height)
          assert.ok(pixels.width > 0 && pixels.height > 0)
          assert.ok(Math.abs(pixels.width / pixels.height - ratio) < 0.02)
        }
      }
    }
  }
  const crop = { x: 0.1, y: 0.2, width: 0.6, height: 0.5 }
  const turned = transformCrop(crop, defaultAdjustments(), { ...defaultAdjustments(), rotation: 90 }, 800, 600)
  assert.ok(turned.width > 0 && turned.height > 0)
})
test('brightness preserves alpha and GIF edits are rejected before rasterizing animation', async () => {
  const pixels = new Uint8ClampedArray([100, 120, 140, 90])
  adjustBrightness(pixels, 150)
  assert.deepEqual([...pixels], [150, 180, 210, 90])
  const gif = new Blob(['GIF89a'], { type: 'image/gif' })
  assert.equal(await prepareImage(gif, { x: 0, y: 0, width: 1, height: 1 }), gif)
  await assert.rejects(prepareImage(gif, { x: 0, y: 0, width: 0.5, height: 0.5 }), /animation/)
  assert.throws(() => imageGeometry(100, 100, { rotation: 1, straighten: 0, brightness: 100 }))
})
