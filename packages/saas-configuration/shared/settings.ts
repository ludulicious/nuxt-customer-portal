import { z } from 'zod'

export const portalModuleIds = ['timesheets', 'invoices', 'service-requests', 'invoice-timesheets', 'invoice-service-requests'] as const
export type PortalModuleId = (typeof portalModuleIds)[number]
export const portalThemeNames = ['apex', 'brutal'] as const
export type PortalThemeName = (typeof portalThemeNames)[number]
export const portalColorModePolicies = ['light-only', 'dark-only', 'user-choice'] as const
export type PortalColorModePolicy = (typeof portalColorModePolicies)[number]
export const portalOnboardingSteps = ['branding', 'modules', 'home', 'legal', 'review'] as const
export type PortalOnboardingStep = (typeof portalOnboardingSteps)[number]

const text = (maximum: number) => z.string().trim().max(maximum)
const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hexadecimal color')
const image = z
  .string()
  .max(2_800_000)
  .refine(
    (value) => !value || /^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value),
    'Use a PNG, JPEG, or WebP image'
  )
const link = z
  .string()
  .trim()
  .max(500)
  .refine((value) => !value || value.startsWith('/') || z.url().safeParse(value).success, 'Use a valid URL or path')

export const portalBrandingSchema = z.object({
  portalName: text(100).min(2),
  tagline: text(160),
  supportEmail: z.email().or(z.literal('')),
  supportUrl: link,
  markLight: image,
  markDark: image,
  logoLight: image,
  logoDark: image
})

const featureSchema = z.object({ title: text(120), description: text(500), visible: z.boolean() })
const homeSchema = z.object({
  heroTitle: text(160),
  heroDescription: text(1000),
  heroActionLabel: text(80),
  heroActionUrl: link,
  introductionTitle: text(160),
  introductionBody: text(4000),
  features: z.array(featureSchema).max(6),
  supportTitle: text(160),
  supportBody: text(2000),
  supportVisible: z.boolean()
})
const legalSchema = z.object({ title: text(160), body: text(30000) })
const localizedContentSchema = z.object({ home: homeSchema, terms: legalSchema, privacy: legalSchema })

export const portalSettingsSchema = z
  .object({
    branding: portalBrandingSchema,
    appearance: z.object({
      theme: z.enum(portalThemeNames),
      colorMode: z.enum(portalColorModePolicies),
      primaryLight: color,
      primaryDark: color
    }),
    enabledModules: z
      .array(z.enum(portalModuleIds))
      .min(1)
      .transform((values) => [...new Set(values)]),
    content: z.object({ en: localizedContentSchema, nl: localizedContentSchema })
  })
  .superRefine((value, context) => {
    if (
      value.enabledModules.includes('invoice-timesheets') &&
      (!value.enabledModules.includes('timesheets') || !value.enabledModules.includes('invoices'))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['enabledModules'],
        message: 'Invoice from timesheets requires both Timesheets and Invoices'
      })
    }
    if (
      value.enabledModules.includes('invoice-service-requests') &&
      (!value.enabledModules.includes('service-requests') || !value.enabledModules.includes('invoices'))
    ) {
      context.addIssue({ code: 'custom', path: ['enabledModules'], message: 'Invoice from service requests requires both Service Requests and Invoices' })
    }
  })

export type PortalBranding = z.infer<typeof portalBrandingSchema>
export type PortalContent = z.infer<typeof localizedContentSchema>
export type PortalSettings = z.infer<typeof portalSettingsSchema>
export interface PortalOnboardingState {
  adminExists: boolean
  completed: boolean
  step: PortalOnboardingStep
}

const defaultLocaleContent = (locale: 'en' | 'nl'): PortalContent =>
  locale === 'nl'
    ? {
        home: {
          heroTitle: 'Uw klantenportaal',
          heroDescription: 'Eén veilige plek voor samenwerking met uw klanten.',
          heroActionLabel: 'Inloggen',
          heroActionUrl: '/login',
          introductionTitle: 'Welkom',
          introductionBody: 'Configureer deze pagina in de portaalinstellingen.',
          features: [],
          supportTitle: 'Ondersteuning',
          supportBody: 'Neem contact met ons op wanneer u hulp nodig heeft.',
          supportVisible: true
        },
        terms: { title: 'Algemene voorwaarden', body: 'Voeg hier uw algemene voorwaarden toe.' },
        privacy: { title: 'Privacybeleid', body: 'Voeg hier uw privacybeleid toe.' }
      }
    : {
        home: {
          heroTitle: 'Your customer portal',
          heroDescription: 'One secure place to collaborate with your customers.',
          heroActionLabel: 'Sign in',
          heroActionUrl: '/login',
          introductionTitle: 'Welcome',
          introductionBody: 'Configure this page in the portal settings.',
          features: [],
          supportTitle: 'Support',
          supportBody: 'Contact us whenever you need help.',
          supportVisible: true
        },
        terms: { title: 'Terms of service', body: 'Add your terms of service here.' },
        privacy: { title: 'Privacy policy', body: 'Add your privacy policy here.' }
      }

export const defaultPortalSettings = (name = 'Customer Portal'): PortalSettings => ({
  branding: {
    portalName: name,
    tagline: 'Customer workspace',
    supportEmail: '',
    supportUrl: '',
    markLight: '',
    markDark: '',
    logoLight: '',
    logoDark: ''
  },
  appearance: { theme: 'apex', colorMode: 'user-choice', primaryLight: '#ea580c', primaryDark: '#fb923c' },
  enabledModules: [...portalModuleIds],
  content: { en: defaultLocaleContent('en'), nl: defaultLocaleContent('nl') }
})

export const resolveBrandAsset = (branding: PortalBranding, kind: 'mark' | 'logo', dark: boolean) => {
  const preferred = branding[`${kind}${dark ? 'Dark' : 'Light'}` as keyof PortalBranding]
  const fallback = branding[`${kind}${dark ? 'Light' : 'Dark'}` as keyof PortalBranding]
  return String(preferred || fallback || '')
}
