import { z } from 'zod'

const text = (max: number) => z.string().trim().max(max)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => !value || (/^https?:\/\//.test(value) && z.url().safeParse(value).success))

export const checkoutAppearanceSchema = z.object({
  hostName: text(120).default(''),
  logoUrl: optionalUrl.default(''),
  returnUrl: optionalUrl.default(''),
  displayFontFamily: text(200).default('ui-serif, Georgia, serif'),
  bodyFontFamily: text(200).default('ui-sans-serif, system-ui, sans-serif'),
  paperColor: color.default('#faf7fa'),
  surfaceColor: color.default('#ffffff'),
  inkColor: color.default('#332f35'),
  mutedColor: color.default('#686168'),
  displayColor: color.default('#563273'),
  accentColor: color.default('#008f91'),
  actionColor: color.default('#563273'),
  focusColor: color.default('#cc6f2f'),
  borderColor: color.default('#d8e7e6'),
  radius: z.number().min(0).max(40).default(18),
  reassurance: text(300).default('')
})

export type CheckoutAppearance = z.output<typeof checkoutAppearanceSchema>

export const defaultCheckoutAppearance = (): CheckoutAppearance => checkoutAppearanceSchema.parse({})
