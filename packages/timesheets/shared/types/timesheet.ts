export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED'
export type ClientAccessMode = 'DISABLED' | 'VIEW' | 'REVIEW'
export type ClientReviewStatus = 'PENDING' | 'APPROVED' | 'DISPUTED'

export interface TimesheetsListPagination {
  total: number
  page: number
  pageSize: number
  pageCount: number
}
export interface TimesheetsListResponse<T> {
  items: T[]
  pagination: TimesheetsListPagination
}

export interface TimesheetSettingsDto {
  currency: string
  timezone: string
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
  accessMode: ClientAccessMode
}

export interface ClientWorkspaceDto {
  id: string
  workspaceOrganizationId: string
  workspaceName: string
  accessMode: ClientAccessMode
  canReview: boolean
  canManageReviewers: boolean
}
export interface ClientReviewerDto {
  id: string
  name: string
  email: string
  role: string
  assigned: boolean
  fixedAccess: boolean
}
export interface ClientTimesheetEntryDto {
  id: string
  date: string
  project: string
  person: string
  activity: string
  minutes: number
  note: string | null
}
export interface ClientTimesheetHistoryDto {
  id: string
  action: 'SUBMITTED' | 'APPROVED_INTERNAL' | 'REOPENED' | 'APPROVED_CLIENT' | 'DISPUTED_CLIENT'
  actorName: string
  comment: string | null
  createdAt: string
}
export interface ClientTimesheetSliceDto {
  weeklyTimesheetId: string
  submissionId: string
  weekStartsOn: string
  periodStartsOn: string
  periodEndsOn: string
  person: string
  status: ClientReviewStatus
  version: number
  comment: string | null
  reviewedAt: string | null
  entries: ClientTimesheetEntryDto[]
  history: ClientTimesheetHistoryDto[]
}
export interface ClientTimesheetsDto {
  workspace: ClientWorkspaceDto
  slices: ClientTimesheetSliceDto[]
}
export interface ClientApprovalItemDto {
  id: string
  workspaceClientId: string
  supplierName: string
  weeklyTimesheetId: string
  submissionId: string
  weekStartsOn: string
  periodStartsOn: string
  periodEndsOn: string
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
export interface ClientApprovalSupplierOptionDto {
  id: string
  name: string
}

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
  internal: boolean
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
  submissionId: string | null
  submissionStatus: TimesheetStatus | null
}

export interface TimesheetSubmissionDto {
  id: string
  periodStartsOn: string
  periodEndsOn: string
  status: TimesheetStatus
  submittedAt: string | null
  reviewedAt: string | null
  reviewedById: string | null
  reviewerName: string | null
  reviewerImage: string | null
  rejectionComment: string | null
  version: number
  entryIds: string[]
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
  submissions: TimesheetSubmissionDto[]
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
  canViewSupplierTime: boolean
  canAccessApprovals: boolean
  canManageClientReviewers: boolean
  pendingInternalApprovalCount: number
  pendingClientApprovalCount: number
  unassignedClientReviewerSupplierCount: number
}

export interface TimesheetsDashboardDto {
  myWeek?: {
    weekStartsOn: string
    status: TimesheetStatus
    totalMinutes: number
    rejectionComment: string | null
    hasRunningTimer: boolean
    batches: Array<{
      id: string
      status: TimesheetStatus
      totalMinutes: number
      periodStartsOn: string
      periodEndsOn: string
    }>
    unsubmitted: {
      totalMinutes: number
      periodStartsOn: string
      periodEndsOn: string
    } | null
  }
  internalApprovals?: {
    pendingCount: number
    items: Array<
      Pick<
        ApprovalQueueItemDto,
        | 'id'
        | 'userName'
        | 'weekStartsOn'
        | 'periodStartsOn'
        | 'periodEndsOn'
        | 'totalMinutes'
        | 'submittedAt'
        | 'status'
      >
    >
  }
  clientApprovals?: {
    pendingCount: number
    unassignedSupplierCount: number
    items: Array<
      Pick<
        ClientApprovalItemDto,
        'id' | 'supplierName' | 'person' | 'weekStartsOn' | 'periodStartsOn' | 'periodEndsOn' | 'totalMinutes'
      >
    >
  }
  supplierTimesheets?: {
    items: Array<
      Pick<
        ClientSupplierTimesheetItemDto,
        'id' | 'supplierName' | 'person' | 'weekStartsOn' | 'periodStartsOn' | 'periodEndsOn' | 'totalMinutes'
      >
    >
  }
}

export interface ApprovalQueueItemDto {
  id: string
  userId: string
  userName: string
  weekStartsOn: string
  periodStartsOn: string
  periodEndsOn: string
  status: TimesheetStatus
  totalMinutes: number
  billableMinutes: number
  billableAmountMinor: number
  currency: string
  submittedAt: string | null
  entries: TimeEntryDto[]
  clientReviews: Array<{ clientOrganizationId: string; status: ClientReviewStatus; comment: string | null }>
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
