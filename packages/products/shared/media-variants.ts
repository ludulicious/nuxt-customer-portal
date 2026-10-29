import { z } from 'zod'

export const mediaVariantKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]{0,39}$/)
  .refine((key) => !['image', 'original', 'full'].includes(key), { message: 'Reserved image variant key' })
export const mediaVariantPresetSchema = z.object({
  key: mediaVariantKeySchema,
  label: z.string().trim().min(1).max(80),
  width: z.number().int().min(16).max(2400),
  height: z.number().int().min(16).max(2400)
})
export const mediaVariantPresetsSchema = z
  .array(mediaVariantPresetSchema)
  .min(1)
  .max(12)
  .refine((presets) => new Set(presets.map((preset) => preset.key)).size === presets.length, {
    message: 'Variant keys must be unique'
  })
  .refine((presets) => presets.some((preset) => preset.key === 'thumbnail'), {
    message: 'A thumbnail variant is required'
  })
export type MediaVariantPreset = z.infer<typeof mediaVariantPresetSchema>
export interface MediaVariantConfiguration {
  presets: MediaVariantPreset[]
  revision: number
}
export const defaultMediaVariantPresets = (): MediaVariantPreset[] => [
  { key: 'thumbnail', label: 'Thumbnail', width: 400, height: 400 },
  { key: 'gallery', label: 'Gallery', width: 800, height: 1000 },
  { key: 'detail', label: 'Detail', width: 1200, height: 900 }
]
export const mediaVariantSettingsSchema = z.object({
  presets: mediaVariantPresetsSchema,
  revision: z.number().int().positive()
})
