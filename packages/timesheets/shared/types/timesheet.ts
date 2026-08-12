export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED'
export type ClientAccessMode = 'DISABLED' | 'VIEW' | 'REVIEW'
export type ClientReviewStatus = 'PENDING' | 'APPROVED' | 'DISPUTED'

export interface TimesheetsListPagination { total: number, page: number, pageSize: number, pageCount: number }
export interface TimesheetsListResponse<T> { items: T[], pagination: TimesheetsListPagination }

export interface TimesheetSettingsDto {
  currency: string
  timezone: string
  defaultVatRateBasisPoints: number
  weekStartsOn: number
  internalApprovalsEnabled: boolean
}

export interface TeamMemberDto {
  id: string
  name: string
  email: string
  image: string | null
  organizationRole: string
  defaultHourlyRateMinor: number | null
  canEnterTime: boolean
  internalApprovalRequired: boolean
  approverUserIds: string[]
}

export interface InternalApprovalConfigurationDto {
  enabled: boolean
  members: TeamMemberDto[]
}

export interface InternalApprovalQueueDto {
  settings: TimesheetSettingsDto
  approvals: ApprovalQueueItemDto[]
  clients: ClientDto[]
  projects: ProjectDto[]
  activities: ActivityTypeDto[]
}

export interface TimesheetsSetupStatusDto {
  complete: boolean
  hasClient: boolean
  hasActiveActivity: boolean
  hasConfiguredProject: boolean
  billableWorkExists: boolean
  enabledMemberCount: number
  missingDefaultTariffCount: number
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
  accessMode: ClientAccessMode
  invoiceAccessEnabled: boolean
}

export interface ClientWorkspaceDto { id: string, workspaceOrganizationId: string, workspaceName: string, accessMode: ClientAccessMode, invoiceAccessEnabled: boolean, canReview: boolean, canViewInvoices: boolean, canManageReviewers: boolean }
export interface ClientReviewerDto { id: string, name: string, email: string, role: string, assigned: boolean, fixedAccess: boolean }
export interface ClientInvoiceViewerDto { id: string, name: string, email: string, role: string, assigned: boolean, fixedAccess: boolean }
export interface ClientInvoiceSupplierDto extends ClientWorkspaceDto { viewerCount: number }
export interface ClientTimesheetEntryDto { id: string, date: string, project: string, person: string, activity: string, minutes: number, note: string | null }
export interface ClientTimesheetHistoryDto { id: string, action: 'SUBMITTED' | 'APPROVED_INTERNAL' | 'REOPENED' | 'APPROVED_CLIENT' | 'DISPUTED_CLIENT', actorName: string, comment: string | null, createdAt: string }
export interface ClientTimesheetSliceDto { weeklyTimesheetId: string, weekStartsOn: string, person: string, status: ClientReviewStatus, billingStatus: 'AWAITING_INVOICE' | 'PARTIALLY_INVOICED' | 'INVOICED', version: number, comment: string | null, reviewedAt: string | null, entries: ClientTimesheetEntryDto[], history: ClientTimesheetHistoryDto[] }
export interface ClientTimesheetsDto { workspace: ClientWorkspaceDto, slices: ClientTimesheetSliceDto[] }
export interface ClientApprovalItemDto {
  id: string
  workspaceClientId: string
  supplierName: string
  weeklyTimesheetId: string
  weekStartsOn: string
  person: string
  totalMinutes: number
  status: ClientReviewStatus
  version: number
  comment: string | null
  reviewedAt: string | null
  reviewerName: string | null
  hasReviewers: boolean
  canAct: boolean
  canManageReviewers: boolean
  entries: ClientTimesheetEntryDto[]
  history: ClientTimesheetHistoryDto[]
}
export interface ClientApprovalsDto {
  isAdmin: boolean
  pendingCount: number
  items: ClientApprovalItemDto[]
}
export interface ClientSupplierTimesheetItemDto extends ClientTimesheetSliceDto {
  id: string
  workspaceClientId: string
  supplierName: string
  totalMinutes: number
}
export interface ClientReviewerSupplierDto extends ClientWorkspaceDto {
  pendingCount: number
  reviewerCount: number
}
export interface ClientApprovalSupplierOptionDto { id: string, name: string }

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
  canEnterTime: boolean
  setupStatus: TimesheetsSetupStatusDto
}

export interface TimesheetCapabilitiesDto {
  canEnterTime: boolean
  canApproveInternalTimesheets: boolean
  hasInternalApprovalAssignments: boolean
  canManageTimesheets: boolean
  canReviewClientTimesheets: boolean
  canInvoice: boolean
  canViewSupplierTime: boolean
  canAccessApprovals: boolean
  canManageClientReviewers: boolean
  canViewClientInvoices: boolean
  canManageInvoiceViewers: boolean
  pendingInternalApprovalCount: number
  pendingClientApprovalCount: number
  unassignedClientReviewerSupplierCount: number
}

export interface TimesheetsDashboardDto {
  myWeek?: { weekStartsOn: string, status: TimesheetStatus, totalMinutes: number, rejectionComment: string | null, hasRunningTimer: boolean }
  internalApprovals?: { pendingCount: number, items: Array<Pick<ApprovalQueueItemDto, 'id' | 'userName' | 'weekStartsOn' | 'totalMinutes' | 'submittedAt' | 'status'>> }
  clientApprovals?: { pendingCount: number, unassignedSupplierCount: number, items: Array<Pick<ClientApprovalItemDto, 'id' | 'supplierName' | 'person' | 'weekStartsOn' | 'totalMinutes'>> }
  supplierTimesheets?: { items: Array<Pick<ClientSupplierTimesheetItemDto, 'id' | 'supplierName' | 'person' | 'weekStartsOn' | 'totalMinutes' | 'billingStatus'>> }
  salesInvoices?: { currency: string, draftCount: number, issuedCount: number, overdueCount: number, outstandingMinor: number, recent: Array<Pick<InvoiceDto, 'id' | 'number' | 'recipientName' | 'status' | 'dueDate' | 'outstandingMinor' | 'isOverdue'>> }
  receivedInvoices?: { currency: string | null, overdueCount: number, outstandingMinor: number, recent: ClientInvoiceSummaryDto[] }
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
  clientReviews: Array<{ clientOrganizationId: string, status: ClientReviewStatus, comment: string | null }>
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
export type ClientInvoiceSummaryDto = Pick<InvoiceDto, 'id' | 'number' | 'status' | 'currency' | 'issueDate' | 'dueDate' | 'subject' | 'totalMinor' | 'outstandingMinor' | 'isOverdue' | 'daysOverdue'> & { supplierName: string, workspaceClientId: string }
export type ClientInvoiceDto = Omit<InvoiceDto, 'payments' | 'reminderCount' | 'lastReminderSentAt' | 'history' | 'emailDeliveries'> & {
  supplierName: string
  workspaceClientId: string
  payments?: never
  reminderCount?: never
  lastReminderSentAt?: never
  history?: never
  emailDeliveries?: never
}
export interface InvoiceEmailPreviewDto { to: string, cc: string[], locale: string, subject: string, body: string, senderEmail: string, senderDomain: string, emailProviderConfigured: boolean, senderDomainVerified: boolean, attachments: Array<{ fileName: string, size: number }>, totalAttachmentSize: number, maximumAttachmentSize: number }
export interface InvoiceableEntryDto extends ReportRowDto { weeklyTimesheetId: string }
