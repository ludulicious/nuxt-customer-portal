export type ServiceRequestStatus =
  | 'NEW' | 'EVALUATING' | 'AWAITING_APPROVAL' | 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'DECLINED' | 'CANCELLED'
export type ServiceRequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type ServiceRequestQuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'SUPERSEDED' | 'EXPIRED'
export type ServiceRequestActivityType =
  | 'CREATED' | 'COMMENT' | 'STATUS_CHANGED' | 'ASSIGNED' | 'DETAILS_UPDATED' | 'ATTACHMENT_ADDED'
  | 'ATTACHMENT_REMOVED' | 'QUOTE_SENT' | 'QUOTE_ACCEPTED' | 'QUOTE_DECLINED' | 'INVOICE_CREATED'

export interface ServiceRequestAttachmentDto {
  id: string
  fileName: string
  contentType: string
  size: number
  uploadedById: string
  createdAt: string
}
export type ServiceRequestAttachment = ServiceRequestAttachmentDto
export interface ServiceRequestActivityDto {
  id: string
  type: ServiceRequestActivityType
  actorUserId: string
  actorName: string
  body: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}
export interface ServiceRequestQuoteLineDto {
  id: string
  description: string
  quantityMilli: number
  unit: string
  unitPriceMinor: number
  vatRateBasisPoints: number
  amountMinor: number
  vatMinor: number
}
export interface ServiceRequestQuoteDto {
  id: string
  requestId: string
  version: number
  number: string
  status: ServiceRequestQuoteStatus
  currency: string
  validUntil: string
  notes: string | null
  sentAt: string | null
  acceptedAt: string | null
  declinedAt: string | null
  createdAt: string
  updatedAt: string
  lines: readonly ServiceRequestQuoteLineDto[]
  subtotalMinor: number
  vatMinor: number
  totalMinor: number
}
export interface ServiceRequestAssigneeDto {
  id: string
  name: string
  email: string
  image: string | null
  active: boolean
}
export interface ServiceRequestDto {
  id: string
  title: string
  description: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  requestedDate: string | null
  serviceLocation: string | null
  status: ServiceRequestStatus
  priority: ServiceRequestPriority
  category: string | null
  organizationId: string
  clientOrganizationId: string
  clientName?: string
  createdById: string
  assignedToId: string | null
  assignedToName?: string | null
  internalNotes: string | null
  attachments: readonly ServiceRequestAttachmentDto[]
  activities?: readonly ServiceRequestActivityDto[]
  quotes?: readonly ServiceRequestQuoteDto[]
  createdAt: string
  updatedAt: string
  evaluatingAt: string | null
  acceptedAt: string | null
  startedAt: string | null
  completedAt: string | null
  declinedAt: string | null
  cancelledAt: string | null
}
export type ServiceRequestWithRelationsDto = ServiceRequestDto
export type ServiceRequest = ServiceRequestDto
export type ServiceRequestWithRelations = ServiceRequestWithRelationsDto
export interface ServiceRequestPagination { total: number; page: number; pageSize: number; pageCount: number }
export interface ServiceRequestListResponse { items: ServiceRequestDto[]; pagination: ServiceRequestPagination }
export interface ServiceRequestDashboardDto {
  overview: { activeCount: number; resolvedCount: number; recent: ServiceRequestDto[] }
  attention?: { urgentCount: number; unassignedCount: number; longOpenCount: number; items: ServiceRequestDto[] }
}
export interface ServiceRequestFilters {
  clientOrganizationId?: string
  status?: ServiceRequestStatus
  priority?: ServiceRequestPriority
  category?: string
  assignedToId?: string
  createdById?: string
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'requestedDate' | 'status' | 'priority'
  sortDir?: 'asc' | 'desc'
}
export interface ServiceRequestCreateInput {
  clientOrganizationId?: string
  title: string
  description: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  requestedDate?: string
  serviceLocation?: string
  priority?: ServiceRequestPriority
  category?: string
}
export type ServiceRequestUpdateInput = Partial<Omit<ServiceRequestCreateInput, 'clientOrganizationId'>>
export interface AdminServiceRequestUpdateInput extends ServiceRequestUpdateInput {
  status?: ServiceRequestStatus
  assignedToId?: string | null
  internalNotes?: string
}
export interface ServiceRequestQuoteCreateInput {
  currency: string
  validUntil: string
  notes?: string
  lines: Array<{ description: string; quantityMilli: number; unit: string; unitPriceMinor: number; vatRateBasisPoints: number }>
}
