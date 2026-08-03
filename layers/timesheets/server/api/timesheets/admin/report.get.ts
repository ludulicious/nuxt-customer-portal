import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { getReport, reportToCsv } from '#layers/timesheets/server/utils/timesheet-repository'
import { reportQuerySchema } from '#layers/timesheets/server/utils/timesheet-validation'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminReportGet',
    summary: 'Get a timesheets report',
    description: 'Get a timesheets report. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(
    event,
    timesheetsFeature.policy,
    'report'
  )
  const rawQuery = getQuery(event)
  const format = rawQuery.format
  const report = await getReport(organizationId, reportQuerySchema.parse(rawQuery))
  if (format === 'csv') {
    setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
    setResponseHeader(event, 'content-disposition', 'attachment; filename="timesheets.csv"')
    return reportToCsv(report)
  }
  return report
})
