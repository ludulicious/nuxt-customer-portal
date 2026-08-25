import type { PortalEmailLocale, PortalEmailText } from '@nuxt-customer-portal/core/shared/types/feature'

export type PortalEmailSettings = {
  configured: boolean
  keyLastFour: string | null
  fromName: string
  fromEmail: string
  defaultLocale: PortalEmailLocale
  htmlTemplate: string
  usingProjectTemplate: boolean
  textOverrides: Record<string, Partial<PortalEmailText>>
  updatedAt: string | null
}
