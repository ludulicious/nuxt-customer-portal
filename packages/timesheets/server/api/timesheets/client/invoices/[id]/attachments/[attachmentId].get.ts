import { requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { getClientInvoiceAttachment } from '@nuxt-customer-portal/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const attachment = await getClientInvoiceAttachment(organizationId, session.user.id, role === 'owner' || role === 'admin' || session.user.role === 'admin', getRouterParam(event, 'id')!, getRouterParam(event, 'attachmentId')!)
  setResponseHeaders(event, { 'Content-Type': attachment.contentType, 'Content-Length': attachment.size, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`, 'Cache-Control': 'private, no-store' })
  return Buffer.from(attachment.contentBase64, 'base64')
})
