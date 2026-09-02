import type {
  ActivityTypeDto,
  ApprovalQueueItemDto,
  ClientOrganizationOptionDto,
  ClientDto,
  ProjectDto,
  TeamMemberDto,
  TimesheetBootstrapDto,
  TimesheetReportDto,
  TimeEntryDto,
  ClientAccessMode,
  ClientTimesheetsDto,
  ClientWorkspaceDto,
  ClientReviewerDto,
  ClientReviewerSupplierDto,
  ClientApprovalSupplierOptionDto,
  TimesheetsDashboardDto,
  TimesheetsSetupStatusDto,
  InternalApprovalConfigurationDto,
  InternalApprovalQueueDto
} from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

export interface TimesheetsAdminBootstrap {
  providerOrganization: { organizationId: string; name: string }
  settings: { currency: string; timezone: string; weekStartsOn: number; internalApprovalsEnabled: boolean }
  clients: ClientDto[]
  availableClientOrganizations: ClientOrganizationOptionDto[]
  projects: ProjectDto[]
  activities: ActivityTypeDto[]
  team: TeamMemberDto[]
  approvals: ApprovalQueueItemDto[]
  setupStatus: TimesheetsSetupStatusDto
}
export interface OrganizationTimesheetCapabilities {
  workspaceEnabled: boolean
  clientOf: Array<{ workspaceOrganizationId: string; workspaceName: string; accessMode: ClientAccessMode }>
}

export const useTimesheets = () => {
  const bootstrap = (week?: string) => $fetch<TimesheetBootstrapDto>('/api/timesheets/bootstrap', { query: { week } })
  const dashboard = () => $fetch<TimesheetsDashboardDto>('/api/timesheets/dashboard')
  const internalApprovalQueue = () => $fetch<InternalApprovalQueueDto>('/api/timesheets/internal-approvals')
  const internalApprovalConfiguration = () =>
    $fetch<InternalApprovalConfigurationDto>('/api/timesheets/admin/internal-approvals')
  const updateInternalApprovalWorkspace = (enabled: boolean) =>
    $fetch('/api/timesheets/admin/internal-approvals', { method: 'PATCH', body: { enabled } })
  const updateInternalApprovalMember = (userId: string, input: { required: boolean; approverUserIds: string[] }) =>
    $fetch(`/api/timesheets/admin/internal-approvals/${userId}`, { method: 'PUT', body: input })
  const setupStatus = () => $fetch<TimesheetsSetupStatusDto>('/api/timesheets/setup-status')

  const createEntry = (input: {
    projectId: string
    activityTypeId: string
    entryDate: string
    durationMinutes: number
    note?: string | null
  }) => $fetch<TimeEntryDto>('/api/timesheets/entries', { method: 'POST', body: input })

  const updateEntry = (
    id: string,
    input: Partial<{
      projectId: string
      activityTypeId: string
      entryDate: string
      durationMinutes: number
      note: string | null
    }>
  ) => $fetch<TimeEntryDto>(`/api/timesheets/entries/${id}`, { method: 'PATCH', body: input })

  const deleteEntry = (id: string) => $fetch(`/api/timesheets/entries/${id}`, { method: 'DELETE' as never })

  const startTimer = (input: { projectId: string; activityTypeId: string; entryDate: string; note?: string | null }) =>
    $fetch<TimeEntryDto>('/api/timesheets/timer', { method: 'POST', body: input })

  const stopTimer = () => $fetch<TimeEntryDto>('/api/timesheets/timer', { method: 'DELETE' as never })

  const submitWeek = (id: string, cutoffDate: string) =>
    $fetch(`/api/timesheets/weeks/${id}/submissions`, { method: 'POST', body: { cutoffDate } })
  const resubmitSubmission = (id: string) => $fetch(`/api/timesheets/submissions/${id}/resubmit`, { method: 'POST' })

  const adminBootstrap = (section?: string) =>
    $fetch<TimesheetsAdminBootstrap>('/api/timesheets/admin/bootstrap', { query: section ? { section } : undefined })
  const createClient = (
    input: { mode: 'link'; organizationId: string } | { mode: 'create'; name: string; slug: string }
  ) => $fetch('/api/timesheets/admin/clients', { method: 'POST', body: input })
  const getClientDeletionEligibility = (id: string) =>
    $fetch<{ clientId: string; clientName: string; canDelete: boolean }>(`/api/timesheets/admin/clients/${id}/deletion`)
  const deleteClient = (id: string, clientName: string) =>
    $fetch(`/api/timesheets/admin/clients/${id}`, {
      method: 'DELETE' as never,
      body: { clientName }
    })
  const updateClientAccess = (id: string, accessMode: ClientAccessMode) =>
    $fetch(`/api/timesheets/admin/clients/${id}`, { method: 'PATCH', body: { accessMode } })
  const getOrganizationTimesheetCapabilities = (organizationId: string) =>
    $fetch<OrganizationTimesheetCapabilities>(`/api/timesheets/admin/organization-capabilities/${organizationId}`)
  const updateOrganizationTimesheetCapabilities = (organizationId: string, input: { workspaceEnabled: boolean }) =>
    $fetch(`/api/timesheets/admin/organization-capabilities/${organizationId}`, { method: 'PATCH', body: input })
  const clientWorkspaces = () => $fetch<ClientWorkspaceDto[]>('/api/timesheets/client/workspaces')
  const clientApprovalSuppliers = () =>
    $fetch<ClientApprovalSupplierOptionDto[]>('/api/timesheets/client/approval-suppliers')
  const clientSupplierOptions = () =>
    $fetch<ClientApprovalSupplierOptionDto[]>('/api/timesheets/client/supplier-options')
  const clientReviewerSuppliers = () => $fetch<ClientReviewerSupplierDto[]>('/api/timesheets/client/reviewer-suppliers')
  const clientTimesheets = (workspaceClientId: string) =>
    $fetch<ClientTimesheetsDto>(`/api/timesheets/client/${workspaceClientId}`)
  const reviewClientSlice = (
    workspaceClientId: string,
    submissionId: string,
    input: { action: 'APPROVE' | 'DISPUTE'; expectedVersion: number; comment?: string | null }
  ) => $fetch(`/api/timesheets/client/${workspaceClientId}/reviews/${submissionId}`, { method: 'POST', body: input })
  const clientReviewers = (workspaceClientId: string) =>
    $fetch<ClientReviewerDto[]>(`/api/timesheets/client/${workspaceClientId}/reviewers`)
  const setClientReviewer = (workspaceClientId: string, userId: string, assigned: boolean) =>
    $fetch(`/api/timesheets/client/${workspaceClientId}/reviewers`, { method: 'PUT', body: { userId, assigned } })
  const createActivity = (input: { name: string; billable: boolean }) =>
    $fetch('/api/timesheets/admin/activities', { method: 'POST', body: input })
  const updateActivity = (id: string, input: Partial<{ name: string; billable: boolean; active: boolean }>) =>
    $fetch(`/api/timesheets/admin/activities/${id}`, { method: 'PATCH', body: input })
  const getActivityDeletionEligibility = (id: string) =>
    $fetch<{ activityId: string; activityName: string; canDelete: boolean }>(
      `/api/timesheets/admin/activities/${id}/deletion`
    )
  const deleteActivity = (id: string, activityName: string) =>
    $fetch(`/api/timesheets/admin/activities/${id}`, {
      method: 'DELETE' as never,
      body: { activityName }
    })
  const createProject = (input: {
    clientOrganizationId: string
    name: string
    code?: string | null
    budgetMinutes?: number | null
    budgetMinor?: number | null
    activityTypeIds: string[]
  }) => $fetch<{ id: string }>('/api/timesheets/admin/projects', { method: 'POST', body: input })
  const getProject = (id: string) => $fetch<ProjectDto>(`/api/timesheets/admin/projects/${id}`)
  const updateProject = (id: string, input: Record<string, unknown>) =>
    $fetch(`/api/timesheets/admin/projects/${id}`, { method: 'PATCH', body: input })
  const getProjectDeletionEligibility = (id: string) =>
    $fetch<{ projectId: string; projectName: string; canDelete: boolean }>(
      `/api/timesheets/admin/projects/${id}/deletion`
    )
  const deleteProject = (id: string, projectName: string) =>
    $fetch(`/api/timesheets/admin/projects/${id}`, {
      method: 'DELETE' as never,
      body: { projectName }
    })
  const setTeamTariff = (userId: string, hourlyRateMinor: number) =>
    $fetch('/api/timesheets/admin/tariffs', {
      method: 'PUT',
      body: { userId, hourlyRateMinor }
    })
  const updateTeamMemberSettings = (
    userId: string,
    input: { canEnterTime: boolean; defaultHourlyRateMinor: number | null }
  ) => $fetch(`/api/timesheets/admin/team/${userId}`, { method: 'PUT', body: input })
  const updateSettings = (input: { currency?: string; timezone?: string }) =>
    $fetch('/api/timesheets/admin/settings', { method: 'PATCH', body: input })
  const reviewSubmission = (id: string, action: 'APPROVE' | 'REJECT' | 'REOPEN', comment?: string | null) =>
    $fetch(`/api/timesheets/internal-approvals/${id}`, {
      method: 'POST',
      body: { action, comment }
    })
  const getReport = (query: Record<string, string | undefined>) =>
    $fetch<TimesheetReportDto>('/api/timesheets/admin/report', { query })

  return {
    bootstrap,
    dashboard,
    internalApprovalQueue,
    internalApprovalConfiguration,
    updateInternalApprovalWorkspace,
    updateInternalApprovalMember,
    setupStatus,
    createEntry,
    updateEntry,
    deleteEntry,
    startTimer,
    stopTimer,
    submitWeek,
    resubmitSubmission,
    adminBootstrap,
    createClient,
    getClientDeletionEligibility,
    deleteClient,
    updateClientAccess,
    getOrganizationTimesheetCapabilities,
    updateOrganizationTimesheetCapabilities,
    clientWorkspaces,
    clientApprovalSuppliers,
    clientSupplierOptions,
    clientReviewerSuppliers,
    clientTimesheets,
    reviewClientSlice,
    clientReviewers,
    setClientReviewer,
    createActivity,
    updateActivity,
    getActivityDeletionEligibility,
    deleteActivity,
    createProject,
    getProject,
    updateProject,
    getProjectDeletionEligibility,
    deleteProject,
    setTeamTariff,
    updateTeamMemberSettings,
    updateSettings,
    reviewSubmission,
    getReport
  }
}
