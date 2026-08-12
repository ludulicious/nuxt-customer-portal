import { z } from 'zod'
import { registerPortalOpenApiContracts } from '@nuxt-customer-portal/core/server/utils/openapi-contracts'
import {
  billingContactCreateSchema,
  billingContactUpdateSchema,
  invoiceCreateSchema,
  invoiceEmailDeliverySchema,
  invoiceIssueSchema,
  invoiceListQuerySchema,
  invoicePaymentSchema,
  invoiceSettingsSchema,
  invoiceUpdateSchema
} from '../utils/invoice-validation'

const refresh = z.object({ refresh: z.enum(['1']).optional() })
const locale = z.object({ locale: z.enum(['nl', 'en']).optional() })

export default defineNitroPlugin(() => registerPortalOpenApiContracts({
  owner: 'invoices',
  query: {
    invoicesAdminInvoicesGet: invoiceListQuerySchema,
    invoicesAdminEmailDomainGet: refresh,
    invoicesAdminInvoicesByIdEmailStatusPost: refresh,
    invoicesAdminInvoicesByIdEmailPreviewGet: locale,
    invoicesAdminInvoicesByIdReminderPreviewGet: locale,
    invoicesAdminInvoicesByIdPdfGet: locale
  },
  body: {
    invoicesAdminSettingsPut: invoiceSettingsSchema,
    invoicesAdminInvoicesPost: invoiceCreateSchema,
    invoicesAdminInvoicesByIdPatch: z.union([invoiceUpdateSchema, invoiceIssueSchema]),
    invoicesAdminInvoicesByIdPaymentsPost: invoicePaymentSchema,
    invoicesAdminInvoicesByIdIssuePost: invoiceEmailDeliverySchema,
    invoicesAdminInvoicesByIdEmailPost: invoiceEmailDeliverySchema,
    invoicesAdminInvoicesByIdReminderPost: invoiceEmailDeliverySchema,
    invoicesAdminClientsByClientIdContactsPost: billingContactCreateSchema,
    invoicesAdminClientsByClientIdContactsByIdPatch: billingContactUpdateSchema
  },
  requestBody: {
    invoicesAdminInvoicesByIdAttachmentsPost: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary', description: 'Invoice attachment file.' } } } } } }
  }
}))
