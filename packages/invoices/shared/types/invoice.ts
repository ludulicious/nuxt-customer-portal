export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID'
export interface InvoiceLineDto {
  id: string
  description: string
  quantityMilli: number
  unit: string
  unitPriceMinor: number
  vatRateBasisPoints: number
  amountMinor: number
}
export interface InvoicePaymentDto {
  id: string
  paidOn: string
  amountMinor: number
  reference: string | null
  note: string | null
}
export interface InvoiceHistoryDto {
  id: string
  action: string
  actorName: string
  amountMinor: number | null
  attachmentName: string | null
  createdAt: string
}
export interface InvoiceAttachmentDto {
  id: string
  fileName: string
  contentType: string
  size: number
  uploadedByName: string
  createdAt: string
}
export interface InvoiceEmailDeliveryDto {
  id: string
  purpose: 'INVOICE' | 'REMINDER'
  status: 'PENDING' | 'SENT' | 'FAILED'
  recipientEmail: string
  ccEmails: string[]
  locale: string
  subject: string
  actorName: string
  providerMessageId: string | null
  providerLastEvent: string | null
  providerStatusCheckedAt: string | null
  errorMessage: string | null
  createdAt: string
  sentAt: string | null
}
export interface InvoiceDto {
  id: string
  organizationId: string
  clientOrganizationId: string | null
  number: string
  status: InvoiceStatus
  currency: string
  issueDate: string
  dueDate: string
  subject: string | null
  notes: string | null
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
  issuedAt: string | null
  createdAt: string
  updatedAt: string
  lines: InvoiceLineDto[]
  payments: InvoicePaymentDto[]
  history: InvoiceHistoryDto[]
  attachments: InvoiceAttachmentDto[]
  emailDeliveries: InvoiceEmailDeliveryDto[]
  subtotalMinor: number
  vatMinor: number
  totalMinor: number
  paidMinor: number
  outstandingMinor: number
  isOverdue: boolean
  daysOverdue: number
  reminderCount: number
  lastReminderSentAt: string | null
}
export type ClientInvoiceSummaryDto = Pick<
  InvoiceDto,
  | 'id'
  | 'number'
  | 'status'
  | 'currency'
  | 'issueDate'
  | 'dueDate'
  | 'subject'
  | 'totalMinor'
  | 'outstandingMinor'
  | 'isOverdue'
  | 'daysOverdue'
> & { supplierName: string; accessId: string }
export type ClientInvoiceDto = Omit<
  InvoiceDto,
  'payments' | 'reminderCount' | 'lastReminderSentAt' | 'history' | 'emailDeliveries'
> & {
  supplierName: string
  accessId: string
  payments?: never
  reminderCount?: never
  lastReminderSentAt?: never
  history?: never
  emailDeliveries?: never
}
export type InvoiceHistoryAction =
  | 'CREATED'
  | 'EDITED'
  | 'ISSUED'
  | 'VOIDED'
  | 'UNVOIDED'
  | 'PAYMENT_REGISTERED'
  | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_REMOVED'
  | 'EMAIL_SENT'
  | 'REMINDER_SENT'
export type InvoiceEmailPurpose = 'INVOICE' | 'REMINDER'
export interface OrganizationInvoiceProfileDto extends InvoiceSettingsDto {
  name: string
  logo: string | null
}
export interface InvoiceSettingsDto {
  organizationId: string
  enabled: boolean
  currency: string
  defaultVatRateBasisPoints: number
  address: string
  registrationNumber: string | null
  vatNumber: string | null
  iban: string | null
  bic: string | null
  invoiceEmail: string | null
  invoiceEmailTemplate: string | null
  preferredLocale: 'nl' | 'en'
}
export interface InvoiceCapabilitiesDto {
  canConfigureInvoices: boolean
  canManageInvoices: boolean
  canViewReceivedInvoices: boolean
  canManageViewers: boolean
  invoicesEnabled: boolean
}
export interface ClientInvoiceSupplierDto {
  id: string
  providerOrganizationId: string
  providerName: string
  canViewInvoices: boolean
}
export interface ClientInvoiceViewerDto {
  id: string
  name: string
  email: string
  role: string
  assigned: boolean
  fixedAccess: boolean
}
export interface InvoiceEmailPreviewDto {
  to: string
  cc: string[]
  locale: string
  subject: string
  body: string
  senderEmail: string
  senderDomain: string
  emailProviderConfigured: boolean
  senderDomainVerified: boolean
  attachments: Array<{ fileName: string; size: number }>
  totalAttachmentSize: number
  maximumAttachmentSize: number
}
export interface InvoiceEmailStatusRefreshDto {
  deliveries: InvoiceEmailDeliveryDto[]
  failures: Array<{ deliveryId: string; code: 'PROVIDER_NOT_CONFIGURED' | 'PROVIDER_LOOKUP_FAILED' }>
}
export interface InvoiceContactDto {
  id: string
  name: string
  email: string
  phone: string | null
  jobTitle: string | null
}
export interface InvoiceClientDto {
  id: string
  organizationId: string
  name: string
  officialName: string
  address: string
  registrationNumber: string | null
  vatNumber: string | null
  invoiceEmail: string | null
  preferredLocale: 'nl' | 'en'
  contacts: InvoiceContactDto[]
}
export interface InvoiceSourceEntryDto {
  entryId: string
  date: string
  client: string
  clientOrganizationId: string
  project: string
  projectId: string
  person: string
  activity: string
  minutes: number
  hourlyRateMinor: number
  amountMinor: number
  currency: string
  note: string | null
}
export type InvoiceableEntryDto = InvoiceSourceEntryDto
export interface InvoicesListPagination {
  total: number
  page: number
  pageSize: number
  pageCount: number
}
export interface InvoicesListResponse<T> {
  items: T[]
  pagination: InvoicesListPagination
}
export interface InvoiceSourceProvider {
  id: string
  labelKey: string
  descriptionKey: string
  load: (query: { from: string; to: string }) => Promise<{ enabled: boolean; entries: InvoiceSourceEntryDto[] }>
  create: (input: Record<string, unknown>) => Promise<unknown>
}
