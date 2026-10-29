export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}
export interface ImageAdjustments {
  rotation: number
  straighten: number
  brightness: number
}
export const defaultAdjustments = (): ImageAdjustments => ({
  rotation: 0,
  straighten: 0,
  brightness: 100
})
export function hasAdjustments(value: ImageAdjustments) {
  return value.rotation !== 0 || value.straighten !== 0 || value.brightness !== 100
}
export function imageGeometry(width: number, height: number, adjustments = defaultAdjustments()) {
  if (
    ![width, height].every((n) => Number.isFinite(n) && n > 0) ||
    ![0, 90, 180, 270].includes(adjustments.rotation) ||
    !Number.isFinite(adjustments.straighten) ||
    Math.abs(adjustments.straighten) > 15 ||
    !Number.isFinite(adjustments.brightness) ||
    adjustments.brightness < 50 ||
    adjustments.brightness > 150
  ) {
    throw new Error('Choose valid image adjustments.')
  }
  const sideways = adjustments.rotation % 180 !== 0
  const orientedWidth = sideways ? height : width
  const orientedHeight = sideways ? width : height
  const radians = (Math.abs(adjustments.straighten) * Math.PI) / 180
  // The largest centered rectangle with the same aspect ratio inside the turned image.
  // Trim the exposed corners rather than enlarging or rescaling the source pixels.
  const scale = Math.min(
    orientedWidth / (orientedWidth * Math.cos(radians) + orientedHeight * Math.sin(radians)),
    orientedHeight / (orientedWidth * Math.sin(radians) + orientedHeight * Math.cos(radians))
  )
  return {
    width: Math.max(1, Math.floor(orientedWidth * scale)),
    height: Math.max(1, Math.floor(orientedHeight * scale)),
    angle: adjustments.rotation + adjustments.straighten
  }
}
export function rotateCrop(
  crop: CropRect,
  clockwise: boolean,
  width: number,
  height: number,
  ratio?: number | null
): CropRect {
  const rotated = clockwise
    ? {
        x: 1 - crop.y - crop.height,
        y: crop.x,
        width: crop.height,
        height: crop.width
      }
    : {
        x: crop.y,
        y: 1 - crop.x - crop.width,
        width: crop.height,
        height: crop.width
      }
  const frame = cropFrame(rotated.width * width, rotated.height * height, ratio || null, 100, 50, 50)
  return {
    x: Math.max(0, rotated.x + frame.x * rotated.width),
    y: Math.max(0, rotated.y + frame.y * rotated.height),
    width: frame.width * rotated.width,
    height: frame.height * rotated.height
  }
}
/** Reframe a selection when the image turns, preserving its zoom and position. */
export function transformCrop(
  selection: CropRect,
  before: ImageAdjustments,
  after: ImageAdjustments,
  width: number,
  height: number,
  requiredRatio?: number | null
): CropRect {
  let result = { ...selection }
  const settings = { ...before }
  function framing() {
    const size = imageGeometry(width, height, settings)
    const ratio = (result.width * size.width) / (result.height * size.height)
    const largest = cropFrame(size.width, size.height, ratio, 100, 50, 50)
    return {
      ratio,
      originalShape: Math.abs(ratio - size.width / size.height) < 0.001,
      size: (result.width / largest.width) * 100,
      horizontal: result.width < 1 ? (result.x / (1 - result.width)) * 100 : 50,
      vertical: result.height < 1 ? (result.y / (1 - result.height)) * 100 : 50
    }
  }
  const turns = ((after.rotation - before.rotation + 360) % 360) / 90
  const clockwise = turns !== 3
  for (let step = 0; step < (clockwise ? turns : 1); step++) {
    const frame = framing()
    settings.rotation = (settings.rotation + (clockwise ? 90 : 270)) % 360
    const next = imageGeometry(width, height, settings)
    result = requiredRatio
      ? cropFrame(
          next.width,
          next.height,
          requiredRatio,
          frame.size,
          clockwise ? 100 - frame.vertical : frame.vertical,
          clockwise ? frame.horizontal : 100 - frame.horizontal
        )
      : rotateCrop(result, clockwise, next.width, next.height)
  }
  if (after.straighten !== before.straighten) {
    const frame = framing()
    const next = imageGeometry(width, height, after)
    result = cropFrame(
      next.width,
      next.height,
      requiredRatio || (frame.originalShape ? null : frame.ratio),
      frame.size,
      frame.horizontal,
      frame.vertical
    )
  }
  return result
}
export function adjustBrightness(pixels: Uint8ClampedArray, brightness: number) {
  const factor = brightness / 100
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = pixels[i]! * factor
    pixels[i + 1] = pixels[i + 1]! * factor
    pixels[i + 2] = pixels[i + 2]! * factor
  }
}
/** Ratios in navigation metadata accept 4:3, 16/9, or a positive number. */
export function aspectRatio(value: unknown): number | null {
  if (value === undefined || value === null || value === '') {
    return null
  }
  const parts = String(value).trim().split(/[:/]/)
  const ratio = parts.length === 2 ? Number(parts[0]) / Number(parts[1]) : parts.length === 1 ? Number(parts[0]) : NaN
  if (!Number.isFinite(ratio) || ratio <= 0 || parts.some((part) => !part.trim() || Number(part) <= 0)) {
    throw new Error('Define an aspect ratio such as 4:3 or 16:9 in the image library settings.')
  }
  return ratio
}
export const fullCrop = (): CropRect => ({ x: 0, y: 0, width: 1, height: 1 })
export function cropFrame(
  imageWidth: number,
  imageHeight: number,
  ratio: number | null,
  size: number,
  horizontal: number,
  vertical: number
): CropRect {
  const aspect = imageWidth / imageHeight
  let width = 1,
    height = 1
  if (ratio && ratio > aspect) {
    height = aspect / ratio
  } else if (ratio) {
    width = ratio / aspect
  }
  const scale = Math.max(0.1, Math.min(1, size / 100))
  width *= scale
  height *= scale
  return {
    width,
    height,
    x: (1 - width) * Math.max(0, Math.min(1, horizontal / 100)),
    y: (1 - height) * Math.max(0, Math.min(1, vertical / 100))
  }
}
export function cropPixels(crop: CropRect, width: number, height: number) {
  if (![width, height].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error('The image dimensions could not be read.')
  }
  if (
    ![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) ||
    crop.x < 0 ||
    crop.y < 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    crop.x + crop.width > 1.000001 ||
    crop.y + crop.height > 1.000001
  ) {
    throw new Error('Choose a crop inside the image.')
  }
  const x = Math.round(crop.x * width),
    y = Math.round(crop.y * height)
  const sourceWidth = Math.max(1, Math.min(width - x, Math.round(crop.width * width))),
    sourceHeight = Math.max(1, Math.min(height - y, Math.round(crop.height * height)))
  return {
    x,
    y,
    sourceWidth,
    sourceHeight,
    width: sourceWidth,
    height: sourceHeight
  }
}
export function isFullCrop(crop: CropRect) {
  return crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1
}
export function previewBlob(url: string): Blob {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(url)
  if (!match) {
    throw new Error('This image could not be read from the website.')
  }
  const binary = atob(match[2]!)
  return new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], {
    type: match[1]
  })
}
export async function prepareImage(blob: Blob, crop: CropRect, adjustments = defaultAdjustments()): Promise<Blob> {
  imageGeometry(1, 1, adjustments)
  if (isFullCrop(crop) && !hasAdjustments(adjustments)) {
    return blob
  }
  if (blob.type === 'image/gif') {
    throw new Error('GIF images keep their animation and cannot be cropped or adjusted.')
  }
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const geometry = imageGeometry(image.naturalWidth, image.naturalHeight, adjustments)
    const rect = cropPixels(crop, geometry.width, geometry.height)
    const canvas = document.createElement('canvas')
    canvas.width = rect.width
    canvas.height = rect.height
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('The image could not be prepared. Try again.')
    }
    if (adjustments.rotation || adjustments.straighten) {
      context.translate(geometry.width / 2 - rect.x, geometry.height / 2 - rect.y)
      context.rotate((geometry.angle * Math.PI) / 180)
      context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
    } else {
      context.drawImage(image, rect.x, rect.y, rect.sourceWidth, rect.sourceHeight, 0, 0, rect.width, rect.height)
    }
    if (adjustments.brightness !== 100) {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
      adjustBrightness(pixels.data, adjustments.brightness)
      context.putImageData(pixels, 0, 0)
    }
    const output = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('The image could not be saved.'))),
        blob.type,
        0.92
      )
    )
    if (output.type !== blob.type) {
      throw new Error('This image format cannot be cropped in this browser. Choose JPG or PNG.')
    }
    return output
  } finally {
    URL.revokeObjectURL(url)
  }
}
