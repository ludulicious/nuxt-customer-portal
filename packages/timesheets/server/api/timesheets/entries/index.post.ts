import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { timesheetsFeature } from '@nuxt-customer-portal/timesheets/shared/feature'
import {
  createEntry,
  requireTimesheetWorkspace
} from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'
import { entryCreateSchema } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
    operationId: 'timesheetsEntriesPost',
    summary: 'Create a time entry',
    description: 'Create a time entry. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { session, organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'create')
  await requireTimesheetWorkspace(organizationId)
  return createEntry(organizationId, session.user.id, entryCreateSchema.parse(await readBody(event)))
})
