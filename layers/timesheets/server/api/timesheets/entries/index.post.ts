import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { createEntry } from '#layers/timesheets/server/utils/timesheet-repository'
import { entryCreateSchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsEntriesPost',
    summary: 'Create a time entry',
    description: 'Create a time entry. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'create'
  )
  return createEntry(
    organizationId,
    session.user.id,
    entryCreateSchema.parse(await readBody(event))
  )
})
