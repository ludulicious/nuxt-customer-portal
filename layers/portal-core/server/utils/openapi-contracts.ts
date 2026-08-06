import { z } from 'zod'
import {
  adminUpdateServiceRequestSchema,
  createServiceRequestSchema,
  filterServiceRequestSchema,
  updateServiceRequestSchema
} from '../../../service-requests/server/utils/service-request-validation'
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
} from '../../../timesheets/server/utils/timesheet-validation'
import type { OpenApiDocument } from './openapi-order'

type JsonSchema = Record<string, unknown>
type OpenApiOperation = Record<string, unknown>

const id = z.string().min(1).max(128)
const refreshQuerySchema = z.object({ refresh: z.enum(['1']).optional() })
const organizationEmailProviderQuerySchema = z.object({ organizationId: id.optional(), refresh: z.enum(['1']).optional() })
const localeQuerySchema = z.object({ locale: z.enum(['nl', 'en']).optional() })
const userQuerySchema = z.object({ search: z.string().trim().max(200).optional() })
const genericUserQuerySchema = z.object({
  take: z.coerce.number().int().min(1).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  sortField: z.string().optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
  filters: z.string().describe('JSON-encoded array of field, operator, and value filter objects.').optional()
})

const querySchemas: Record<string, z.ZodType> = {
  generalAdminUsersGet: userQuerySchema,
  generalAdminUsersQueryGet: genericUserQuerySchema,
  generalOrganizationsEmailProviderDelete: organizationEmailProviderQuerySchema,
  generalOrganizationsEmailProviderGet: organizationEmailProviderQuerySchema,
  generalOrganizationsEmailProviderPut: organizationEmailProviderQuerySchema,
  generalOrganizationsGetInvitationGet: z.object({ id }),
  serviceRequestsGet: filterServiceRequestSchema,
  serviceRequestsAdminGet: filterServiceRequestSchema,
  timesheetsBootstrapGet: weekQuerySchema,
  timesheetsAdminBootstrapGet: z.object({ section: z.enum(['approvals', 'clients', 'projects', 'activities', 'rates', 'settings', 'reports', 'invoices']).optional() }),
  timesheetsAdminActivitiesGet: activityListQuerySchema,
  timesheetsAdminClientsGet: clientListQuerySchema,
  timesheetsAdminProjectsGet: projectListQuerySchema,
  timesheetsAdminInvoicesGet: invoiceListQuerySchema,
  timesheetsAdminReportGet: reportQuerySchema,
  timesheetsAdminEmailDomainGet: refreshQuerySchema,
  timesheetsAdminInvoicesByIdEmailStatusPost: refreshQuerySchema,
  timesheetsAdminInvoicesByIdEmailPreviewGet: localeQuerySchema,
  timesheetsAdminInvoicesByIdReminderPreviewGet: localeQuerySchema,
  timesheetsAdminInvoicesByIdPdfGet: localeQuerySchema
}

const bodySchemas: Record<string, z.ZodType> = {
  generalAdminOrganizationsPost: z.object({ name: z.string().min(1), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }),
  generalAdminOrganizationsByIdPatch: z.object({
    name: z.string().min(1), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    officialCompanyName: z.string().min(1).max(200), logo: z.string().max(2_800_000)
  }),
  generalAdminOrganizationsByIdInvitationsPost: z.object({ email: z.string().email(), role: z.enum(['member', 'admin', 'owner']) }),
  generalAdminUsersByIdRolePatch: z.object({ role: z.enum(['user', 'admin']) }),
  generalOrganizationsAcceptInvitationPost: z.object({ invitationId: id }),
  generalOrganizationsEmailProviderPut: z.object({ apiKey: z.string().min(8).max(500) }),
  generalProfilePatch: z.object({ name: z.string().min(1).max(255).optional(), image: z.string().url().nullable().optional() }),
  serviceRequestsPost: createServiceRequestSchema,
  serviceRequestsByIdPatch: updateServiceRequestSchema,
  serviceRequestsAdminByIdPatch: adminUpdateServiceRequestSchema,
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
}

const parameterDescriptions: Record<string, string> = {
  search: 'Free-text search term.', page: 'One-based page number.', pageSize: 'Number of records per page.',
  sortBy: 'Field used to sort the results.', sortDir: 'Sort direction.', refresh: 'Set to 1 to refresh external provider status.',
  locale: 'Locale used to render localized invoice content.', week: 'Any date in the requested ISO week (YYYY-MM-DD).',
  section: 'Administration section whose supporting data should be loaded.', id: 'Invitation identifier.'
}

const jsonSchema = (schema: z.ZodType): JsonSchema => {
  const result = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as JsonSchema
  delete result.$schema
  return result
}

const queryParameters = (schema: z.ZodType): Array<Record<string, unknown>> => {
  const converted = jsonSchema(schema)
  const properties = (converted.properties ?? {}) as Record<string, JsonSchema>
  const required = new Set((converted.required ?? []) as string[])
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: 'query',
    required: required.has(name),
    description: property.description ?? parameterDescriptions[name],
    schema: property
  }))
}

const addContract = (operation: OpenApiOperation): void => {
  const operationId = String(operation.operationId ?? '')
  const querySchema = querySchemas[operationId]
  if (querySchema) {
    operation.parameters = [...((operation.parameters ?? []) as unknown[]), ...queryParameters(querySchema)]
  }
  const bodySchema = bodySchemas[operationId]
  if (bodySchema) {
    operation.requestBody = {
      required: true,
      content: { 'application/json': { schema: jsonSchema(bodySchema) } }
    }
  }
  if (operationId === 'timesheetsAdminInvoicesByIdAttachmentsPost') {
    operation.requestBody = {
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
}

export const enrichOpenApiContracts = <T extends OpenApiDocument>(document: T): T => {
  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const operation of Object.values(pathItem)) addContract(operation)
  }
  return document
}
