import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { requireFeatureAccess, db } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { workspaceClient } from '@nuxt-customer-portal/timesheets/server/db/schema/timesheets'
import { ensureTimesheetClientSettings } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

const schema = z.object({ accessMode: z.enum(['DISABLED', 'VIEW', 'REVIEW']) })

export default defineEventHandler(async (event) => {
  const { organizationId, organizationType } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  if (organizationType !== 'PROVIDER') throw createError({ statusCode: 403, message: 'PROVIDER organization required' })
  const clientOrganizationId = getRouterParam(event, 'clientId')!
  await ensureTimesheetClientSettings(organizationId, clientOrganizationId)
  const [updated] = await db.update(workspaceClient).set({ ...schema.parse(await readBody(event)), updatedAt: new Date() }).where(and(eq(workspaceClient.workspaceOrganizationId, organizationId), eq(workspaceClient.clientOrganizationId, clientOrganizationId))).returning()
  return updated
})
