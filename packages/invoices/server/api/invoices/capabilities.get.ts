import { eq } from 'drizzle-orm'
import { db, requireActiveOrganizationRole } from '@nuxt-customer-portal/core/server/portal'
import { invoiceClientAccess, invoiceClientViewer, invoiceSettings } from '@nuxt-customer-portal/invoices/server/db/schema/invoices'
import { listClientInvoiceSuppliers } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'

export default defineEventHandler(async (event) => {
  const { session, organizationId, organizationType, role } = await requireActiveOrganizationRole(event)
  const isAdmin = role === 'owner' || role === 'admin' || session.user.role === 'admin'
  const settings = await db.select({ enabled: invoiceSettings.enabled }).from(invoiceSettings).where(eq(invoiceSettings.organizationId, organizationId)).limit(1)
  const suppliers = organizationType === 'CLIENT' ? await listClientInvoiceSuppliers(organizationId, session.user.id, isAdmin) : []
  const invoicesEnabled = settings[0]?.enabled ?? false
  const canConfigureInvoices = organizationType === 'PROVIDER' && isAdmin
  return { canConfigureInvoices, canManageInvoices: canConfigureInvoices && invoicesEnabled, canViewReceivedInvoices: suppliers.length > 0, canManageViewers: isAdmin && suppliers.length > 0, invoicesEnabled }
})
