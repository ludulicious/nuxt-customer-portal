import { requireActiveOrganizationRole } from '#portal/server/portal'
import { generateInvoicePdf } from '#layers/timesheets/server/utils/invoice-pdf'
import { getClientInvoice } from '#layers/timesheets/server/utils/timesheet-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, role } = await requireActiveOrganizationRole(event)
  const selected = await getClientInvoice(organizationId, session.user.id, role === 'owner' || role === 'admin' || session.user.role === 'admin', getRouterParam(event, 'id')!)
  const query = getQuery(event)
  const pdf = await generateInvoicePdf(selected, typeof query.locale === 'string' ? query.locale : undefined)
  const disposition = query.download === '1' ? 'attachment' : 'inline'
  const fileName = `invoice-${selected.number.replace(/[^a-z0-9._-]+/gi, '-')}.pdf`
  setResponseHeaders(event, { 'Content-Type': 'application/pdf', 'Content-Disposition': `${disposition}; filename="${fileName}"`, 'Cache-Control': 'private, no-store' })
  return Buffer.from(pdf)
})
