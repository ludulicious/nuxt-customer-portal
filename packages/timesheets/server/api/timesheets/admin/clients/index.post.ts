import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { linkClient } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { clientCreateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminClientsPost',
    summary: 'Link a timesheet client',
    description: 'Link a timesheet client. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'manage'
  )
  const input = clientCreateSchema.parse(await readBody(event))
  if (input.mode === 'create') {
    throw createError({ statusCode: 410, message: 'Create clients in the Clients module before linking them to Timesheets' })
  }
  return linkClient(
    organizationId,
    session.user.id,
    session.user.role === 'admin',
    input.organizationId
  )
})
