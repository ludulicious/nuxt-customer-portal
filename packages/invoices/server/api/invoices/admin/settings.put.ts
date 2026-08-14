import { requireFeatureAccess } from '@nuxt-customer-portal/core/server/portal'
import { invoicesFeature } from '@nuxt-customer-portal/invoices/shared/feature'
import { updateInvoiceSettings } from '@nuxt-customer-portal/invoices/server/utils/invoice-repository'
import { invoiceSettingsSchema } from '@nuxt-customer-portal/invoices/server/utils/invoice-validation'
export default defineEventHandler(async (event) => { const { organizationId } = await requireFeatureAccess(event, invoicesFeature.policy, 'manage'); return updateInvoiceSettings(organizationId, invoiceSettingsSchema.parse(await readBody(event))) })
