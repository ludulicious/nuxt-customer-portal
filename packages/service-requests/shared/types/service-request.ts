export type ServiceRequestStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type ServiceRequestPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface ServiceRequestAttachment {
  id: string
  url: string
  filename: string
  size: number
  mimeType: string
  uploadedAt: string
  uploadedById?: string
}

export interface ServiceRequestDto {
  id: string
  title: string
  description: string
  status: ServiceRequestStatus
  priority: ServiceRequestPriority
  category: string | null
  organizationId: string
  createdById: string
  assignedToId: string | null
  attachments: readonly ServiceRequestAttachment[]
  internalNotes: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  closedAt: string | null
}

export interface ServiceRequestWithRelationsDto extends ServiceRequestDto {
  createdBy?: {
    id: string
    name: string
    email: string
    image: string | null
  }
  assignedTo?: {
    id: string
    name: string
    email: string
    image: string | null
  } | null
}

export interface ServiceRequestPagination {
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface ServiceRequestListResponse {
  items: ServiceRequestDto[]
  pagination: ServiceRequestPagination
}

export interface ServiceRequestDashboardDto {
  overview: {
    activeCount: number
    resolvedCount: number
    recent: ServiceRequestDto[]
  }
  attention?: {
    urgentCount: number
    unassignedCount: number
    longOpenCount: number
    items: ServiceRequestDto[]
  }
}

export interface ServiceRequestFilters {
  status?: ServiceRequestStatus
  priority?: ServiceRequestPriority
  category?: string
  assignedToId?: string
  createdById?: string
  search?: string
  page?: number
  pageSize?: number
  sortBy?: 'createdAt' | 'status' | 'priority'
  sortDir?: 'asc' | 'desc'
}

export type ServiceRequest = ServiceRequestDto
export type ServiceRequestWithRelations = ServiceRequestWithRelationsDto

export interface ServiceRequestCreateInput {
  title: string
  description: string
  priority?: ServiceRequestPriority
  category?: string
}

export interface ServiceRequestUpdateInput {
  title?: string
  description?: string
  status?: ServiceRequestStatus
  priority?: ServiceRequestPriority
  category?: string
}

export interface AdminServiceRequestUpdateInput extends ServiceRequestUpdateInput {
  assignedToId?: string
  internalNotes?: string
}
