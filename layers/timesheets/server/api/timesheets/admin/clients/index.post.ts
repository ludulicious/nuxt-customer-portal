import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { linkClient } from '#layers/timesheets/server/utils/timesheet-repository'
import { clientCreateSchema } from '#layers/timesheets/server/utils/timesheet-validation'
import { auth } from '#portal/server/utils/auth'

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
  let clientOrganizationId: string
  if (input.mode === 'create') {
    const created = await auth.api.createOrganization({
      body: {
        name: input.name,
        slug: input.slug,
        userId: session.user.id,
        keepCurrentActiveOrganization: true
      }
    })
    if (!created) throw createError({ statusCode: 500, message: 'Failed to create client organization' })
    clientOrganizationId = created.id
  } else {
    clientOrganizationId = input.organizationId
  }
  return linkClient(
    organizationId,
    session.user.id,
    session.user.role === 'admin',
    clientOrganizationId
  )
})
