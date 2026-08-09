import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import { updateEntry } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { entryUpdateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsEntriesByIdPatch',
    summary: 'Update a time entry',
    description: 'Update a time entry. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'update'
  )
  return updateEntry(
    organizationId,
    session.user.id,
    getRouterParam(event, 'id')!,
    entryUpdateSchema.parse(await readBody(event))
  )
})
