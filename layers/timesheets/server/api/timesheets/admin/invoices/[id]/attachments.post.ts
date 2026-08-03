import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { addInvoiceAttachment } from '#layers/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesByIdAttachmentsPost',
    summary: 'Upload an invoice attachment',
    description: 'Upload an invoice attachment. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId, session } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const parts = await readMultipartFormData(event)
  const file = parts?.find(part => part.name === 'file' && part.filename)
  if (!file?.filename) throw createError({ statusCode: 400, message: 'Select a file to attach' })
  return addInvoiceAttachment(organizationId, session.user.id, getRouterParam(event, 'id')!, {
    fileName: file.filename,
    contentType: file.type || 'application/octet-stream',
    data: file.data
  })
})
