export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED'

export interface TimesheetsListPagination { total: number, page: number, pageSize: number, pageCount: number }
export interface TimesheetsListResponse<T> { items: T[], pagination: TimesheetsListPagination }

export interface TimesheetSettingsDto {
  currency: string
  timezone: string
  defaultVatRateBasisPoints: number
  weekStartsOn: number
}

export interface TeamMemberDto {
  id: string
  name: string
  email: string
  image: string | null
  organizationRole: string
  defaultHourlyRateMinor: number | null
}

export interface ClientDto {
  id: string
  organizationId: string
  name: string
  officialName: string | null
  slug: string
  logo: string | null
  address: string
  registrationNumber: string | null
  vatNumber: string | null
  invoiceEmail: string | null
  preferredLocale: string
  contacts: OrganizationContactDto[]
}

export interface OrganizationContactDto { id: string, userId: string | null, name: string, email: string, phone: string | null, jobTitle: string | null }
export interface OrganizationInvoiceProfileDto { organizationId: string, name: string, logo: string | null, address: string, registrationNumber: string | null, vatNumber: string | null, iban: string | null, bic: string | null, invoiceEmail: string | null, invoiceEmailTemplate: string | null, preferredLocale: string }

export interface ClientOrganizationOptionDto {
  id: string
  name: string
  slug: string
  logo: string | null
}

export interface ActivityTypeDto {
  id: string
  name: string
  billable: boolean
  active: boolean
}

export interface ProjectDto {
  id: string
  clientOrganizationId: string
  clientName: string
  name: string
  code: string | null
  status: ProjectStatus
  startsOn: string | null
  endsOn: string | null
  budgetMinutes: number | null
  budgetMinor: number | null
  activityTypeIds: string[]
  personRates: Record<string, number>
}

export interface TimeEntryDto {
  id: string
  projectId: string
  activityTypeId: string
  entryDate: string
  durationMinutes: number
  note: string | null
  billable: boolean
  hourlyRateMinor: number
  currency: string
  timerStartedAt: string | null
}

export interface WeekDto {
  id: string
  userId: string
  weekStartsOn: string
  status: TimesheetStatus
  submittedAt: string | null
  reviewedAt: string | null
  reviewedById: string | null
  rejectionComment: string | null
  entries: TimeEntryDto[]
}

export interface TimesheetBootstrapDto {
  settings: TimesheetSettingsDto
  clients: ClientDto[]
  projects: ProjectDto[]
  activities: ActivityTypeDto[]
  team: TeamMemberDto[]
  week: WeekDto
}

export interface ApprovalQueueItemDto {
  id: string
  userId: string
  userName: string
  weekStartsOn: string
  status: TimesheetStatus
  totalMinutes: number
  billableMinutes: number
  billableAmountMinor: number
  currency: string
  submittedAt: string | null
  entries: TimeEntryDto[]
}

export interface ReportRowDto {
  entryId: string
  date: string
  client: string
  project: string
  person: string
  activity: string
  minutes: number
  billable: boolean
  hourlyRateMinor: number
  amountMinor: number
  currency: string
  status: TimesheetStatus
  note: string | null
}

export interface TimesheetReportDto {
  rows: ReportRowDto[]
  totals: {
    minutes: number
    billableMinutes: number
    nonBillableMinutes: number
    billableAmountMinor: number
    currency: string
  }
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID'
export type InvoiceSummaryMode = 'PERSON_ACTIVITY' | 'PERSON' | 'ACTIVITY' | 'PROJECT' | 'DETAILED'
export interface InvoiceLineDto { id: string, description: string, quantityMilli: number, unit: string, unitPriceMinor: number, vatRateBasisPoints: number, amountMinor: number }
export interface InvoicePaymentDto { id: string, paidOn: string, amountMinor: number, reference: string | null, note: string | null }
export type InvoiceHistoryAction = 'CREATED' | 'EDITED' | 'ISSUED' | 'VOIDED' | 'UNVOIDED' | 'PAYMENT_REGISTERED' | 'ATTACHMENT_ADDED' | 'ATTACHMENT_REMOVED' | 'EMAIL_SENT' | 'REMINDER_SENT'
export interface InvoiceHistoryDto { id: string, action: InvoiceHistoryAction, actorName: string, amountMinor: number | null, attachmentName: string | null, createdAt: string }
export interface InvoiceAttachmentDto { id: string, fileName: string, contentType: string, size: number, uploadedByName: string, createdAt: string }
export type InvoiceEmailDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED'
export type InvoiceEmailPurpose = 'INVOICE' | 'REMINDER'
export interface InvoiceEmailDeliveryDto { id: string, purpose: InvoiceEmailPurpose, status: InvoiceEmailDeliveryStatus, recipientEmail: string, ccEmails: string[], locale: string, subject: string, actorName: string, providerMessageId: string | null, providerLastEvent: string | null, providerStatusCheckedAt: string | null, errorMessage: string | null, createdAt: string, sentAt: string | null }
export interface InvoiceEmailStatusRefreshDto { deliveries: InvoiceEmailDeliveryDto[], failures: Array<{ deliveryId: string, code: 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_LOOKUP_FAILED' }> }
export interface InvoiceDto {
  id: string
  number: string
  status: InvoiceStatus
  currency: string
  issueDate: string
  dueDate: string
  subject: string | null
  notes: string | null
  clientOrganizationId: string | null
  senderName: string
  senderLogo: string | null
  senderAddress: string
  senderRegistration: string | null
  senderVatNumber: string | null
  senderIban: string | null
  senderBic: string | null
  recipientName: string
  recipientAddress: string
  recipientContactName: string | null
  recipientEmail: string | null
  recipientLocale: string
  lines: InvoiceLineDto[]
  payments: InvoicePaymentDto[]
  subtotalMinor: number
  vatMinor: number
  totalMinor: number
  paidMinor: number
  outstandingMinor: number
  isOverdue: boolean
  daysOverdue: number
  reminderCount: number
  lastReminderSentAt: string | null
  createdAt: string
  updatedAt: string
  issuedAt: string | null
  history?: InvoiceHistoryDto[]
  attachments?: InvoiceAttachmentDto[]
  emailDeliveries?: InvoiceEmailDeliveryDto[]
}
export interface InvoiceEmailPreviewDto { to: string, cc: string[], locale: string, subject: string, body: string, senderEmail: string, senderDomain: string, emailProviderConfigured: boolean, senderDomainVerified: boolean, attachments: Array<{ fileName: string, size: number }>, totalAttachmentSize: number, maximumAttachmentSize: number }
export interface InvoiceableEntryDto extends ReportRowDto { weeklyTimesheetId: string }
