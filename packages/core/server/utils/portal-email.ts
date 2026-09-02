import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import type {
  PortalEmailDefinition,
  PortalEmailLocale,
  PortalEmailText
} from '@nuxt-customer-portal/core/shared/types/feature'
import { portalEmailSettings } from '@nuxt-customer-portal/core/server/db/schema/auth-schema'
import { db, pool } from './db'

export type PortalEmailTextOverrides = Record<string, Partial<PortalEmailText>>

export interface PortalEmailSettingsInput {
  apiKey?: string
  fromName: string
  fromEmail: string
  defaultLocale: PortalEmailLocale
  htmlTemplate: string | null
  textOverrides: PortalEmailTextOverrides
  definitions?: Array<{ moduleId: string; definition: PortalEmailDefinition }>
}

export interface PortalEmailAttachment {
  filename: string
  content: Buffer
  contentType?: string
  contentId?: string
}

const TEMPLATE_PLACEHOLDERS = new Set([
  'subject',
  'brand_name',
  'brand_logo',
  'brand_logo_light',
  'brand_logo_dark',
  'brand_icon_light',
  'brand_icon_dark',
  'brand_tagline',
  'brand_primary_color',
  'body',
  'footer',
  'current_year'
])
const placeholderPattern = /{{\s*([a-z0-9_]+)\s*}}/gi
const senderPattern = /^\s*([^<>]+?)\s*<\s*([^<>]+)\s*>\s*$/

const parseSender = (value = '') => {
  const match = value.match(senderPattern)
  return match ? { fromName: match[1]!.trim(), fromEmail: match[2]!.trim() } : { fromName: '', fromEmail: value.trim() }
}

type PortalEmailBranding = {
  brandName: string
  brandTagline: string
  brandLogoLight: string
  brandLogoDark: string
  brandIconLight: string
  brandIconDark: string
  primaryColor: string
}

export const resolvePortalEmailBranding = async (): Promise<PortalEmailBranding> => {
  const config = useRuntimeConfig()
  const fallback = {
    brandName: String(config.portalEmail?.brandName || 'Nuxt Customer Portal'),
    brandTagline: String(config.portalEmail?.brandTagline || ''),
    brandLogoLight: String(config.portalEmail?.brandLogoLight || config.portalEmail?.brandLogo || ''),
    brandLogoDark: String(config.portalEmail?.brandLogoDark || config.portalEmail?.brandLogo || ''),
    brandIconLight: String(config.portalEmail?.brandIconLight || ''),
    brandIconDark: String(config.portalEmail?.brandIconDark || ''),
    primaryColor: /^#[0-9a-f]{6}$/i.test(String(config.portalEmail?.primaryColor))
      ? String(config.portalEmail.primaryColor)
      : '#0ea5e9'
  }
  if (config.portalEmail?.brandingSource !== 'portal-settings') {
    return fallback
  }
  const result = await pool.query<{
    portal_name: string | null
    tagline: string | null
    logo_light: string | null
    logo_dark: string | null
    mark_light: string | null
    mark_dark: string | null
    primary_light: string | null
  }>(`SELECT
    settings->'branding'->>'portalName' AS portal_name,
    settings->'branding'->>'tagline' AS tagline,
    settings->'branding'->>'logoLight' AS logo_light,
    settings->'branding'->>'logoDark' AS logo_dark,
    settings->'branding'->>'markLight' AS mark_light,
    settings->'branding'->>'markDark' AS mark_dark,
    settings->'appearance'->>'primaryLight' AS primary_light
    FROM saas_configuration.portal_settings WHERE id=true`)
  const branding = result.rows[0]
  return {
    brandName: branding?.portal_name || fallback.brandName,
    brandTagline: branding?.tagline || fallback.brandTagline,
    brandLogoLight: branding?.logo_light || fallback.brandLogoLight,
    brandLogoDark: branding?.logo_dark || fallback.brandLogoDark,
    brandIconLight: branding?.mark_light || fallback.brandIconLight,
    brandIconDark: branding?.mark_dark || fallback.brandIconDark,
    primaryColor: /^#[0-9a-f]{6}$/i.test(branding?.primary_light || '')
      ? branding!.primary_light!
      : fallback.primaryColor
  }
}

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!
  )

const renderBrandAsset = (value: string, brandName: string, sourceOverride?: string) => {
  if (!value || !/^(data:image\/(png|jpeg|webp);base64,|https?:\/\/)/i.test(value)) {
    return ''
  }
  return `<img src="${escapeHtml(sourceOverride || value)}" alt="${escapeHtml(brandName)}" style="display:block;max-width:220px;max-height:72px;margin:0 auto 12px" />`
}

const inlineBrandAsset = (
  value: string,
  brandName: string,
  contentId: string,
  attachments: PortalEmailAttachment[]
) => {
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([a-z0-9+/=\s]+)$/i)
  if (!match) {
    return renderBrandAsset(value, brandName)
  }
  const subtype = match[1]!.toLowerCase()
  const extension = subtype === 'jpeg' ? 'jpg' : subtype
  attachments.push({
    filename: `${contentId}.${extension}`,
    content: Buffer.from(match[2]!.replace(/\s/g, ''), 'base64'),
    contentType: `image/${subtype}`,
    contentId
  })
  return renderBrandAsset(value, brandName, `cid:${contentId}`)
}

const encryptionKey = () => {
  const value = process.env.PORTAL_EMAIL_ENCRYPTION_KEY
  if (!value) {
    throw new Error('PORTAL_EMAIL_ENCRYPTION_KEY is required to store email credentials')
  }
  return createHash('sha256').update(value).digest()
}

export const encryptPortalEmailSecret = (value: string) => {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url')
  ].join('.')
}

export const decryptPortalEmailSecret = (value: string) => {
  const [version, iv, tag, encrypted] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !encrypted) {
    throw new Error('Stored email credential has an invalid format')
  }
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    throw new Error('Stored email credential could not be decrypted')
  }
}

const replacePlaceholders = (input: string, values: Record<string, string>, allowed: Set<string>) =>
  input.replace(placeholderPattern, (_match, key: string) => {
    if (!allowed.has(key)) {
      throw new Error(`Unknown email placeholder: ${key}`)
    }
    if (!(key in values)) {
      throw new Error(`Missing email placeholder value: ${key}`)
    }
    return values[key]!
  })

export const validatePortalEmailTemplate = (template: string) => {
  const found = [...template.matchAll(placeholderPattern)].map((match) => match[1]!)
  if (!found.includes('body')) {
    throw new Error('The email template must contain {{body}}')
  }
  const unknown = found.find((key) => !TEMPLATE_PLACEHOLDERS.has(key))
  if (unknown) {
    throw new Error(`Unknown template placeholder: ${unknown}`)
  }
}

export const validatePortalEmailText = (definition: PortalEmailDefinition, text: PortalEmailText) => {
  const allowed = new Set([...definition.placeholders.map((item) => item.key), 'brand_name'])
  for (const value of [text.subject, text.body, text.footer ?? '']) {
    const unknown = [...value.matchAll(placeholderPattern)].map((match) => match[1]!).find((key) => !allowed.has(key))
    if (unknown) {
      throw new Error(`Unknown ${definition.id} placeholder: ${unknown}`)
    }
  }
}

const defaultTemplate = async () => {
  const config = useRuntimeConfig()
  const storage = config.portalEmail?.templateStorage || 'assets:portal-core'
  const template = await useStorage(storage).getItem<string>('email-template.html')
  if (!template) {
    throw new Error('Default portal email template could not be loaded')
  }
  return template
}

const readRow = async () => {
  const [row] = await db.select().from(portalEmailSettings).where(eq(portalEmailSettings.id, true)).limit(1)
  return row ?? null
}

export const getPortalEmailSettings = async () => {
  const row = await readRow()
  const projectTemplate = await defaultTemplate()
  const environmentSender = parseSender(process.env.RESEND_FROM_EMAIL)
  return {
    provider: 'RESEND' as const,
    configured: Boolean(row?.encryptedApiKey || process.env.RESEND_API_KEY),
    keyLastFour: row?.keyLastFour ?? (process.env.RESEND_API_KEY?.slice(-4) || null),
    fromName: row?.fromName ?? environmentSender.fromName,
    fromEmail: row?.fromEmail ?? environmentSender.fromEmail,
    defaultLocale: row?.defaultLocale === 'nl' ? ('nl' as const) : ('en' as const),
    htmlTemplate: row?.htmlTemplate?.trim() || projectTemplate,
    usingProjectTemplate: !row?.htmlTemplate?.trim(),
    textOverrides: (row?.textOverrides ?? {}) as PortalEmailTextOverrides,
    updatedAt: row?.updatedAt.toISOString() ?? null
  }
}

export const savePortalEmailSettings = async (userId: string, input: PortalEmailSettingsInput) => {
  const template = input.htmlTemplate?.trim() || null
  if (template) {
    validatePortalEmailTemplate(template)
  }
  for (const item of input.definitions ?? []) {
    for (const locale of ['en', 'nl'] as const) {
      const override = input.textOverrides[`${item.moduleId}.${item.definition.id}.${locale}`]
      if (override) {
        validatePortalEmailText(item.definition, { ...item.definition.defaults[locale], ...override })
      }
    }
  }
  const key = input.apiKey?.trim()
  const existing = await readRow()
  const values = {
    provider: 'RESEND',
    encryptedApiKey: key ? encryptPortalEmailSecret(key) : (existing?.encryptedApiKey ?? null),
    keyFingerprint: key ? createHash('sha256').update(key).digest('hex') : (existing?.keyFingerprint ?? null),
    keyLastFour: key ? key.slice(-4) : (existing?.keyLastFour ?? null),
    fromName: input.fromName.trim() || null,
    fromEmail: input.fromEmail.trim().toLowerCase() || null,
    defaultLocale: input.defaultLocale,
    htmlTemplate: template,
    textOverrides: input.textOverrides,
    configuredById: userId,
    updatedAt: new Date()
  }
  await db
    .insert(portalEmailSettings)
    .values({ id: true, ...values })
    .onConflictDoUpdate({
      target: portalEmailSettings.id,
      set: values
    })
  return getPortalEmailSettings()
}

export const resetPortalEmailTemplate = async (userId: string) => {
  const current = await getPortalEmailSettings()
  return savePortalEmailSettings(userId, {
    fromName: current.fromName,
    fromEmail: current.fromEmail,
    defaultLocale: current.defaultLocale,
    htmlTemplate: null,
    textOverrides: current.textOverrides
  })
}

const providerConfiguration = async () => {
  const row = await readRow()
  const apiKey = row?.encryptedApiKey ? decryptPortalEmailSecret(row.encryptedApiKey) : process.env.RESEND_API_KEY
  const environmentSender = parseSender(process.env.RESEND_FROM_EMAIL)
  const fromEmail = row?.fromEmail || environmentSender.fromEmail
  if (!apiKey || !fromEmail) {
    throw new Error('Portal email provider is not configured')
  }
  return { apiKey, fromEmail, fromName: row?.fromName || environmentSender.fromName }
}

export const getPortalEmailProviderStatus = async () => {
  const settings = await getPortalEmailSettings()
  if (!settings.configured) {
    return { ...settings, verifiedDomains: [] as string[] }
  }
  const provider = await providerConfiguration()
  const { data, error } = await new Resend(provider.apiKey).domains.list({ limit: 100 })
  if (error) {
    throw new Error(error.message)
  }
  return {
    ...settings,
    verifiedDomains: data.data
      .filter((item) => item.status === 'verified' && item.capabilities.sending === 'enabled')
      .map((item) => item.name.toLowerCase())
  }
}

export const renderPortalEmail = async (input: {
  moduleId: string
  definition: PortalEmailDefinition
  locale?: string
  values: Record<string, string>
  text?: PortalEmailText
  htmlTemplate?: string
  inlineBrandAssets?: boolean
}) => {
  const [settings, branding] = await Promise.all([getPortalEmailSettings(), resolvePortalEmailBranding()])
  const locale: PortalEmailLocale = input.locale === 'nl' ? 'nl' : input.locale === 'en' ? 'en' : settings.defaultLocale
  const key = `${input.moduleId}.${input.definition.id}.${locale}`
  const text = { ...input.definition.defaults[locale], ...settings.textOverrides[key], ...input.text }
  validatePortalEmailText(input.definition, text)
  const brandName = branding.brandName
  const messageValues = { ...input.values, brand_name: brandName }
  const allowed = new Set([...input.definition.placeholders.map((item) => item.key), 'brand_name'])
  const subject = replacePlaceholders(text.subject, messageValues, allowed)
  const body = replacePlaceholders(text.body, messageValues, allowed)
  const footer = replacePlaceholders(text.footer ?? '', messageValues, allowed)
  const htmlTemplate = input.htmlTemplate ?? settings.htmlTemplate
  validatePortalEmailTemplate(htmlTemplate)
  const inlineAttachments: PortalEmailAttachment[] = []
  const brandAsset = (value: string, key: string) =>
    input.inlineBrandAssets && htmlTemplate.includes(`{{${key}}}`)
      ? inlineBrandAsset(value, brandName, `portal-${key.replaceAll('_', '-')}`, inlineAttachments)
      : renderBrandAsset(value, brandName)
  const html = replacePlaceholders(
    htmlTemplate,
    {
      subject: escapeHtml(subject),
      brand_name: escapeHtml(brandName),
      brand_logo: brandAsset(branding.brandLogoLight || branding.brandLogoDark, 'brand_logo'),
      brand_logo_light: brandAsset(branding.brandLogoLight, 'brand_logo_light'),
      brand_logo_dark: brandAsset(branding.brandLogoDark, 'brand_logo_dark'),
      brand_icon_light: brandAsset(branding.brandIconLight, 'brand_icon_light'),
      brand_icon_dark: brandAsset(branding.brandIconDark, 'brand_icon_dark'),
      brand_tagline: escapeHtml(branding.brandTagline),
      brand_primary_color: branding.primaryColor,
      body,
      footer,
      current_year: String(new Date().getFullYear())
    },
    TEMPLATE_PLACEHOLDERS
  )
  return {
    locale,
    subject,
    body,
    footer,
    html,
    inlineAttachments,
    text: `${body.replace(/<[^>]+>/g, ' ')}\n\n${footer.replace(/<[^>]+>/g, ' ')}`
  }
}

export const sendPortalEmail = async (input: {
  moduleId: string
  definition: PortalEmailDefinition
  locale?: string
  values: Record<string, string>
  to: string
  cc?: string[]
  text?: PortalEmailText
  htmlTemplate?: string
  fromEmail?: string
  fromName?: string
  attachments?: PortalEmailAttachment[]
  idempotencyKey?: string
}) => {
  const [rendered, provider] = await Promise.all([
    renderPortalEmail({ ...input, inlineBrandAssets: true }),
    providerConfiguration()
  ])
  const fromEmail = input.fromEmail || provider.fromEmail
  const fromName = input.fromName || provider.fromName
  const from = fromName ? `${fromName.replace(/[<>\r\n]/g, '')} <${fromEmail}>` : fromEmail
  const { data, error } = await new Resend(provider.apiKey).emails.send(
    {
      from,
      to: [input.to],
      cc: input.cc?.length ? input.cc : undefined,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachments: [...rendered.inlineAttachments, ...(input.attachments ?? [])]
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
  )
  if (error) {
    throw new Error(error.message)
  }
  return { ...data, rendered }
}

export const retrievePortalEmail = async (providerMessageId: string) => {
  const provider = await providerConfiguration()
  const { data, error } = await new Resend(provider.apiKey).emails.get(providerMessageId)
  if (error) {
    throw new Error(error.message)
  }
  return data
}
