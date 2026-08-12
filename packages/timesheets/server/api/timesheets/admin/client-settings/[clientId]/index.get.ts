import { and, eq } from 'drizzle-orm'
import { requireFeatureAccess, db } from '@nuxt-customer-portal/core/server/portal'
import { requireClientModuleEnabled } from '@nuxt-customer-portal/clients/server/utils/client-repository'
import { workspaceClient } from '@nuxt-customer-portal/timesheets/server/db/schema/timesheets'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'

export default defineEventHandler(async (event) => {
  const { organizationId, organizationType } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  if (organizationType !== 'PROVIDER') throw createError({ statusCode: 403, message: 'PROVIDER organization required' })
  const clientOrganizationId = getRouterParam(event, 'clientId')!
  await requireClientModuleEnabled(clientOrganizationId, 'timesheets')
  const [settings] = await db.select().from(workspaceClient).where(and(eq(workspaceClient.workspaceOrganizationId, organizationId), eq(workspaceClient.clientOrganizationId, clientOrganizationId))).limit(1)
  return settings ?? { clientOrganizationId, accessMode: 'DISABLED', invoiceAccessEnabled: false }
})
