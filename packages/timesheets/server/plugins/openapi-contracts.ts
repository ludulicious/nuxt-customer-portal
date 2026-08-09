import { z } from 'zod'
import { registerPortalOpenApiContracts } from '@nuxt-customer-portal/core/server/utils/openapi-contracts'
import {
  activityCreateSchema,
  activityDeleteSchema,
  activityListQuerySchema,
  activityUpdateSchema,
  clientCreateSchema,
  clientDeleteSchema,
  clientListQuerySchema,
  contactCreateSchema,
  contactUpdateSchema,
  entryCreateSchema,
  entryUpdateSchema,
  invoiceCreateSchema,
  invoiceEmailDeliverySchema,
  invoiceIssueSchema,
  invoiceListQuerySchema,
  invoicePaymentSchema,
  invoiceUpdateSchema,
  organizationProfileUpdateSchema,
  projectCreateSchema,
  projectDeleteSchema,
  projectListQuerySchema,
  projectUpdateSchema,
  reportQuerySchema,
  reviewSchema,
  settingsUpdateSchema,
  tariffUpdateSchema,
  teamMemberSettingsUpdateSchema,
  timerStartSchema,
  weekQuerySchema
} from '../utils/timesheet-validation'

const refresh = z.object({ refresh: z.enum(['1']).optional() })
const locale = z.object({ locale: z.enum(['nl', 'en']).optional() })

export default defineNitroPlugin(() => {
  registerPortalOpenApiContracts({
    owner: 'timesheets',
    query: {
      timesheetsBootstrapGet: weekQuerySchema,
      timesheetsAdminBootstrapGet: z.object({ section: z.enum(['approvals', 'clients', 'projects', 'activities', 'rates', 'settings', 'reports', 'invoices']).optional() }),
      timesheetsAdminActivitiesGet: activityListQuerySchema,
      timesheetsAdminClientsGet: clientListQuerySchema,
      timesheetsAdminProjectsGet: projectListQuerySchema,
      timesheetsAdminInvoicesGet: invoiceListQuerySchema,
      timesheetsAdminReportGet: reportQuerySchema,
      timesheetsAdminEmailDomainGet: refresh,
      timesheetsAdminInvoicesByIdEmailStatusPost: refresh,
      timesheetsAdminInvoicesByIdEmailPreviewGet: locale,
      timesheetsAdminInvoicesByIdReminderPreviewGet: locale,
      timesheetsAdminInvoicesByIdPdfGet: locale
    },
    body: {
      timesheetsEntriesPost: entryCreateSchema,
      timesheetsEntriesByIdPatch: entryUpdateSchema,
      timesheetsTimerPost: timerStartSchema,
      timesheetsAdminClientsPost: clientCreateSchema,
      timesheetsAdminClientsByIdDelete: clientDeleteSchema,
      timesheetsAdminOrganizationsByOrganizationIdProfilePatch: organizationProfileUpdateSchema,
      timesheetsAdminOrganizationsByOrganizationIdContactsPost: contactCreateSchema,
      timesheetsAdminOrganizationsByOrganizationIdContactsByIdPatch: contactUpdateSchema,
      timesheetsAdminActivitiesPost: activityCreateSchema,
      timesheetsAdminActivitiesByIdPatch: activityUpdateSchema,
      timesheetsAdminActivitiesByIdDelete: activityDeleteSchema,
      timesheetsAdminProjectsPost: projectCreateSchema,
      timesheetsAdminProjectsByIdPatch: projectUpdateSchema,
      timesheetsAdminProjectsByIdDelete: projectDeleteSchema,
      timesheetsAdminTariffsPut: tariffUpdateSchema,
      timesheetsAdminTeamMemberPut: teamMemberSettingsUpdateSchema,
      timesheetsAdminSettingsPatch: settingsUpdateSchema,
      timesheetsAdminApprovalsByIdPost: reviewSchema,
      timesheetsAdminInvoicesPost: invoiceCreateSchema,
      timesheetsAdminInvoicesByIdPatch: z.union([invoiceUpdateSchema, invoiceIssueSchema]),
      timesheetsAdminInvoicesByIdPaymentsPost: invoicePaymentSchema,
      timesheetsAdminInvoicesByIdIssuePost: invoiceEmailDeliverySchema,
      timesheetsAdminInvoicesByIdEmailPost: invoiceEmailDeliverySchema,
      timesheetsAdminInvoicesByIdReminderPost: invoiceEmailDeliverySchema
    },
    requestBody: {
      timesheetsAdminInvoicesByIdAttachmentsPost: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: { file: { type: 'string', format: 'binary', description: 'Invoice attachment file.' } }
            }
          }
        }
      }
    }
  })
})
