import type { ClientModuleState, ClientSummaryDto } from '../../shared/types/client'
import { portalImageUrl } from '@nuxt-customer-portal/core/server/utils/portal-image'
import { getOrganizationAvatar } from '@nuxt-customer-portal/core/shared/organization-avatar'

export const clientSummary = (
  row: {
    organizationId: string
    name: string
    slug: string
    logo: string | null
    metadata: string | null
    clientType: 'organization' | 'person'
    firstName: string | null
    lastName: string | null
    timezone: string | null
    officialName: string
    address: string
    registrationNumber: string | null
    vatNumber: string | null
    invoiceEmail: string | null
    preferredLocale: string
    archivedAt: Date | null
  },
  providerTimezone: string,
  modules: ClientModuleState[],
  owner?: {
    userId: string
    image: string | null
    firstName: string | null
    lastName: string | null
  }
): ClientSummaryDto => ({
  id: row.organizationId,
  organizationId: row.organizationId,
  name: row.name,
  slug: row.slug,
  clientType: row.clientType,
  firstName: row.clientType === 'person' ? (row.firstName ?? owner?.firstName ?? null) : null,
  lastName: row.clientType === 'person' ? (row.lastName ?? owner?.lastName ?? null) : null,
  logo: portalImageUrl('organization', row.organizationId, 'logo', row.logo),
  avatarLogo: owner?.image
    ? portalImageUrl('user', owner.userId, 'avatar', owner.image)
    : portalImageUrl('organization', row.organizationId, 'avatar', getOrganizationAvatar(row)),
  timezone: row.timezone,
  schedulingTimezone: row.timezone || providerTimezone,
  officialName: row.officialName,
  address: row.address,
  registrationNumber: row.registrationNumber,
  vatNumber: row.vatNumber,
  invoiceEmail: row.invoiceEmail,
  preferredLocale: row.preferredLocale === 'en' ? 'en' : 'nl',
  archivedAt: row.archivedAt?.toISOString() ?? null,
  modules
})
