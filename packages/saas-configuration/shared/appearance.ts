import { z } from 'zod'
import { primaryForeground } from './primary-contrast'

export const portalFontNames = ['theme', 'playfair', 'lato', 'geist', 'bricolage'] as const
export const portalFonts: Record<(typeof portalFontNames)[number], string> = {
  theme: 'inherit',
  playfair: '"Playfair Display", Georgia, serif',
  lato: 'Lato, Arial, sans-serif',
  geist: 'Geist, Arial, sans-serif',
  bricolage: '"Bricolage Grotesque", Arial, sans-serif'
}
const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hexadecimal color')
const optionalColor = color.or(z.literal('')).default('')

export const portalAppearanceSchema = z.object({
  theme: z.enum(['apex', 'brutal']),
  colorMode: z.enum(['light-only', 'dark-only', 'user-choice']),
  primaryLight: color,
  primaryDark: color,
  headingFont: z.enum(portalFontNames).default('theme'),
  bodyFont: z.enum(portalFontNames).default('theme'),
  secondaryLight: optionalColor,
  secondaryDark: optionalColor,
  backgroundLight: optionalColor,
  backgroundDark: optionalColor,
  surfaceLight: optionalColor,
  surfaceDark: optionalColor,
  shape: z.enum(['theme', 'soft']).default('theme'),
  headerBranding: z.enum(['mark-name', 'full-logo']).default('mark-name')
})
export type PortalAppearance = z.infer<typeof portalAppearanceSchema>
export type PortalAppearancePreset = 'business' | 'soft-editorial'

const presetValues: Record<PortalAppearancePreset, Omit<PortalAppearance, 'theme' | 'colorMode'>> = {
  business: {
    primaryLight: '#ea580c',
    primaryDark: '#fb923c',
    headingFont: 'theme',
    bodyFont: 'theme',
    secondaryLight: '',
    secondaryDark: '',
    backgroundLight: '',
    backgroundDark: '',
    surfaceLight: '',
    surfaceDark: '',
    shape: 'theme',
    headerBranding: 'mark-name'
  },
  'soft-editorial': {
    primaryLight: '#543178',
    primaryDark: '#e4d5ff',
    secondaryLight: '#488b98',
    secondaryDark: '#b6efff',
    backgroundLight: '#f9f5fa',
    backgroundDark: '#211529',
    surfaceLight: '#ffffff',
    surfaceDark: '#302238',
    headingFont: 'playfair',
    bodyFont: 'lato',
    shape: 'soft',
    headerBranding: 'full-logo'
  }
}

// Applying a preset is an explicit editor action. Color-mode policy is preserved.
export function applyAppearancePreset(current: PortalAppearance, preset: PortalAppearancePreset): PortalAppearance {
  return portalAppearanceSchema.parse({
    theme: current.theme,
    colorMode: current.colorMode,
    ...presetValues[preset]
  })
}

export function activeAppearancePreset(appearance: PortalAppearance): PortalAppearancePreset | null {
  return (
    (Object.entries(presetValues).find(([, values]) =>
      Object.entries(values).every(([key, value]) => appearance[key as keyof PortalAppearance] === value)
    )?.[0] as PortalAppearancePreset | undefined) ?? null
  )
}

export function appearanceVariables(input: PortalAppearance, dark: boolean): Record<string, string> {
  // Validate before serializing into a style tag; arbitrary CSS is never accepted.
  const appearance = portalAppearanceSchema.parse(input)
  const primary = dark ? appearance.primaryDark : appearance.primaryLight
  const secondary = dark ? appearance.secondaryDark : appearance.secondaryLight
  const background = dark ? appearance.backgroundDark : appearance.backgroundLight
  const surface = dark ? appearance.surfaceDark : appearance.surfaceLight
  const vars: Record<string, string> = {
    '--portal-primary': primary,
    '--portal-on-primary': primaryForeground(primary),
    '--ui-primary': primary
  }
  for (const shade of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
    const value =
      shade < 500
        ? `color-mix(in srgb, ${primary} ${shade / 5}%, white)`
        : shade === 500 || shade === 600
          ? primary
          : `color-mix(in srgb, ${primary} ${100 - (shade - 600) / 5}%, black)`
    vars[`--color-primary-${shade}`] = value
    vars[`--ui-color-primary-${shade}`] = value
  }
  if (secondary) {
    vars['--ui-secondary'] = secondary
    vars['--portal-secondary'] = secondary
  }
  if (background) {
    const ink = primaryForeground(background)
    vars['--portal-page'] = background
    vars['--ui-bg'] = background
    vars['--ui-bg-muted'] = `color-mix(in srgb, ${background} 94%, ${ink})`
    vars['--ui-bg-accented'] = `color-mix(in srgb, ${background} 88%, ${ink})`
    vars['--ui-text'] = `color-mix(in srgb, ${ink} 85%, ${background})`
    vars['--ui-text-highlighted'] = ink
    vars['--ui-text-toned'] = `color-mix(in srgb, ${ink} 75%, ${background})`
    vars['--ui-text-muted'] = `color-mix(in srgb, ${ink} 65%, ${background})`
    vars['--ui-border'] = `color-mix(in srgb, ${background} 80%, ${ink})`
    vars['--ui-border-muted'] = `color-mix(in srgb, ${background} 90%, ${ink})`
    vars['--ui-border-accented'] = `color-mix(in srgb, ${background} 65%, ${ink})`
  }
  if (surface) {
    vars['--portal-surface'] = surface
    vars['--portal-surface-ink'] = primaryForeground(surface)
    vars['--ui-bg-elevated'] = surface
  }
  if (appearance.bodyFont !== 'theme') {
    vars['--font-sans'] = portalFonts[appearance.bodyFont]
    vars['--portal-body-font'] = portalFonts[appearance.bodyFont]
  }
  if (appearance.headingFont !== 'theme') {
    vars['--portal-heading-font'] = portalFonts[appearance.headingFont]
  }
  if (appearance.shape === 'soft') {
    vars['--ui-radius'] = '0.75rem'
  }
  return vars
}

export function appearanceStylesheet(appearance: PortalAppearance): string {
  const serialize = (dark: boolean) =>
    Object.entries(appearanceVariables(appearance, dark))
      .map(([key, value]) => `${key}:${value}`)
      .join(';')
  return `html:root:not(.dark){${serialize(false)}}html:root.dark{${serialize(true)}}`
}
