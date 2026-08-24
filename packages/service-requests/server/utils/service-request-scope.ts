import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { db, requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { organization } from '@nuxt-customer-portal/core/schema'
import { requireClientModuleEnabled } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { serviceRequestFeature, type ServiceRequestAction } from '@nuxt-customer-portal/service-requests/shared/feature'

export const requireServiceRequestScope = async (event: H3Event, action: ServiceRequestAction) => {
  const context = await requireFeatureAccess(event, serviceRequestFeature.policy, action)
  if (context.organizationType === 'PROVIDER') {
    return {
      ...context,
      providerOrganizationId: context.organizationId,
      clientOrganizationId: undefined,
      ownOnly: false
    }
  }
  await requireClientModuleEnabled(context.organizationId, 'service-requests')
  const [provider] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.organizationType, 'PROVIDER'))
    .limit(1)
  if (!provider) {
    throw createError({ statusCode: 409, message: 'PROVIDER organization is not configured' })
  }
  return {
    ...context,
    providerOrganizationId: provider.id,
    clientOrganizationId: context.organizationId,
    ownOnly: context.role === 'member'
  }
}

export const canAccessScopedRequest = (
  row: { organizationId: string; clientOrganizationId: string; createdById: string },
  scope: Awaited<ReturnType<typeof requireServiceRequestScope>>
) =>
  row.organizationId === scope.providerOrganizationId &&
  (!scope.clientOrganizationId || row.clientOrganizationId === scope.clientOrganizationId) &&
  (!scope.ownOnly || row.createdById === scope.session.user.id)
