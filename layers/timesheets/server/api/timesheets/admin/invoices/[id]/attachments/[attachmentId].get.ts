import { requireFeatureAccess } from '#portal/server/portal'
import { timesheetsFeature } from '#layers/timesheets/shared/feature'
import { getInvoiceAttachment } from '#layers/timesheets/server/utils/timesheet-repository'

defineRouteMeta({
  openAPI: {
    tags: ['Timesheets'],
operationId: 'timesheetsAdminInvoicesByIdAttachmentsByAttachmentIdGet',
    summary: 'Download an invoice attachment',
    description: 'Download an invoice attachment. Scoped to the active organization and the applicable Timesheets permission.'
  }
})

export default defineEventHandler(async (event) => {
  const { organizationId } = await requireFeatureAccess(event, timesheetsFeature.policy, 'manage')
  const attachment = await getInvoiceAttachment(organizationId, getRouterParam(event, 'id')!, getRouterParam(event, 'attachmentId')!)
  setResponseHeader(event, 'content-type', attachment.contentType)
  setResponseHeader(event, 'content-length', attachment.size)
  setResponseHeader(event, 'content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`)
  return Buffer.from(attachment.contentBase64, 'base64')
})
