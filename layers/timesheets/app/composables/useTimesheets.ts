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
  InvoiceDto,
  InvoiceableEntryDto,
  OrganizationInvoiceProfileDto,
  InvoiceEmailPreviewDto,
  InvoiceEmailStatusRefreshDto,
  ClientAccessMode,
  ClientTimesheetsDto,
  ClientWorkspaceDto,
  ClientReviewerDto,
  ClientReviewerSupplierDto,
  ClientApprovalSupplierOptionDto
} from '#layers/timesheets/shared/types/timesheet'

export interface TimesheetsAdminBootstrap {
  settings: { currency: string, timezone: string, defaultVatRateBasisPoints: number, weekStartsOn: number }
  clients: ClientDto[]
  availableClientOrganizations: ClientOrganizationOptionDto[]
  projects: ProjectDto[]
  activities: ActivityTypeDto[]
  team: TeamMemberDto[]
  approvals: ApprovalQueueItemDto[]
  invoices: InvoiceDto[]
  invoiceableEntries: InvoiceableEntryDto[]
  organizationProfile: OrganizationInvoiceProfileDto
}
export interface OrganizationTimesheetCapabilities { workspaceEnabled: boolean, invoicingEnabled: boolean, clientOf: Array<{ workspaceOrganizationId: string, workspaceName: string, accessMode: ClientAccessMode }> }

export const useTimesheets = () => {
  const bootstrap = (week?: string) =>
    $fetch<TimesheetBootstrapDto>('/api/timesheets/bootstrap', { query: { week } })

  const createEntry = (input: {
    projectId: string
    activityTypeId: string
    entryDate: string
    durationMinutes: number
    note?: string | null
  }) => $fetch<TimeEntryDto>('/api/timesheets/entries', { method: 'POST', body: input })

  const updateEntry = (id: string, input: Partial<{
    projectId: string
    activityTypeId: string
    entryDate: string
    durationMinutes: number
    note: string | null
  }>) => $fetch<TimeEntryDto>(`/api/timesheets/entries/${id}`, { method: 'PATCH', body: input })

  const deleteEntry = (id: string) =>
    $fetch(`/api/timesheets/entries/${id}`, { method: 'DELETE' as never })

  const startTimer = (input: {
    projectId: string
    activityTypeId: string
    entryDate: string
    note?: string | null
  }) => $fetch<TimeEntryDto>('/api/timesheets/timer', { method: 'POST', body: input })

  const stopTimer = () =>
    $fetch<TimeEntryDto>('/api/timesheets/timer', { method: 'DELETE' as never })

  const submitWeek = (id: string) =>
    $fetch(`/api/timesheets/weeks/${id}/submit`, { method: 'POST' })

  const adminBootstrap = (section?: string) => $fetch<TimesheetsAdminBootstrap>('/api/timesheets/admin/bootstrap', { query: section ? { section } : undefined })
  const createClient = (input: { mode: 'link', organizationId: string } | { mode: 'create', name: string, slug: string }) =>
    $fetch('/api/timesheets/admin/clients', { method: 'POST', body: input })
  const getClientDeletionEligibility = (id: string) =>
    $fetch<{ clientId: string, clientName: string, canDelete: boolean }>(
      `/api/timesheets/admin/clients/${id}/deletion`
    )
  const deleteClient = (id: string, clientName: string) =>
    $fetch(`/api/timesheets/admin/clients/${id}`, {
      method: 'DELETE' as never,
      body: { clientName }
    })
  const updateClientAccess = (id: string, accessMode: ClientAccessMode) => $fetch(`/api/timesheets/admin/clients/${id}`, { method: 'PATCH', body: { accessMode } })
  const getOrganizationTimesheetCapabilities = (organizationId: string) => $fetch<OrganizationTimesheetCapabilities>(`/api/timesheets/admin/organization-capabilities/${organizationId}`)
  const updateOrganizationTimesheetCapabilities = (organizationId: string, input: { workspaceEnabled: boolean, invoicingEnabled: boolean }) => $fetch(`/api/timesheets/admin/organization-capabilities/${organizationId}`, { method: 'PATCH', body: input })
  const clientWorkspaces = () => $fetch<ClientWorkspaceDto[]>('/api/timesheets/client/workspaces')
  const clientApprovalSuppliers = () => $fetch<ClientApprovalSupplierOptionDto[]>('/api/timesheets/client/approval-suppliers')
  const clientReviewerSuppliers = () => $fetch<ClientReviewerSupplierDto[]>('/api/timesheets/client/reviewer-suppliers')
  const clientTimesheets = (workspaceClientId: string) => $fetch<ClientTimesheetsDto>(`/api/timesheets/client/${workspaceClientId}`)
  const reviewClientSlice = (workspaceClientId: string, weekId: string, input: { action: 'APPROVE' | 'DISPUTE', expectedVersion: number, comment?: string | null }) => $fetch(`/api/timesheets/client/${workspaceClientId}/reviews/${weekId}`, { method: 'POST', body: input })
  const clientReviewers = (workspaceClientId: string) => $fetch<ClientReviewerDto[]>(`/api/timesheets/client/${workspaceClientId}/reviewers`)
  const setClientReviewer = (workspaceClientId: string, userId: string, assigned: boolean) => $fetch(`/api/timesheets/client/${workspaceClientId}/reviewers`, { method: 'PUT', body: { userId, assigned } })
  const updateOrganizationProfile = (organizationId: string, input: Record<string, unknown>) =>
    $fetch(`/api/timesheets/admin/organizations/${organizationId}/profile`, { method: 'PATCH', body: input })
  const createContact = (organizationId: string, input: Record<string, unknown>) =>
    $fetch(`/api/timesheets/admin/organizations/${organizationId}/contacts`, { method: 'POST', body: input })
  const updateContact = (organizationId: string, id: string, input: Record<string, unknown>) =>
    $fetch(`/api/timesheets/admin/organizations/${organizationId}/contacts/${id}`, { method: 'PATCH', body: input })
  const deleteContact = (organizationId: string, id: string) =>
    $fetch(`/api/timesheets/admin/organizations/${organizationId}/contacts/${id}`, { method: 'DELETE' as never })
  const createActivity = (input: { name: string, billable: boolean }) =>
    $fetch('/api/timesheets/admin/activities', { method: 'POST', body: input })
  const updateActivity = (id: string, input: Partial<{ name: string, billable: boolean, active: boolean }>) =>
    $fetch(`/api/timesheets/admin/activities/${id}`, { method: 'PATCH', body: input })
  const getActivityDeletionEligibility = (id: string) =>
    $fetch<{ activityId: string, activityName: string, canDelete: boolean }>(
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
  }) => $fetch('/api/timesheets/admin/projects', { method: 'POST', body: input })
  const updateProject = (id: string, input: Record<string, unknown>) =>
    $fetch(`/api/timesheets/admin/projects/${id}`, { method: 'PATCH', body: input })
  const getProjectDeletionEligibility = (id: string) =>
    $fetch<{ projectId: string, projectName: string, canDelete: boolean }>(
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
  const updateSettings = (input: { currency?: string, timezone?: string, defaultVatRateBasisPoints?: number }) =>
    $fetch('/api/timesheets/admin/settings', { method: 'PATCH', body: input })
  const reviewWeek = (id: string, action: 'APPROVE' | 'REJECT' | 'REOPEN', comment?: string | null) =>
    $fetch(`/api/timesheets/admin/approvals/${id}`, {
      method: 'POST',
      body: { action, comment }
    })
  const getReport = (query: Record<string, string | undefined>) =>
    $fetch<TimesheetReportDto>('/api/timesheets/admin/report', { query })
  const createInvoice = (input: Record<string, unknown>) => $fetch('/api/timesheets/admin/invoices', { method: 'POST', body: input })
  const getNextInvoiceNumber = () => $fetch<{ number: string }>('/api/timesheets/admin/invoices/next-number')
  const getInvoice = (id: string) => $fetch<InvoiceDto>(`/api/timesheets/admin/invoices/${id}`)
  const updateInvoice = (id: string, input: { number: string, issueDate: string, dueDate: string, subject?: string | null, notes?: string | null }) => $fetch(`/api/timesheets/admin/invoices/${id}`, { method: 'PATCH' as never, body: input })
  const changeInvoiceStatus = (id: string, action: 'VOID' | 'UNVOID') => $fetch(`/api/timesheets/admin/invoices/${id}`, { method: 'PATCH' as never, body: { action } })
  const getInvoiceEmailPreview = (id: string, locale?: string) => $fetch<InvoiceEmailPreviewDto>(`/api/timesheets/admin/invoices/${id}/email-preview`, { query: { locale } })
  const issueAndSendInvoice = (id: string, input: Record<string, unknown>) => $fetch(`/api/timesheets/admin/invoices/${id}/issue`, { method: 'POST', body: input })
  const resendInvoice = (id: string, input: Record<string, unknown>) => $fetch(`/api/timesheets/admin/invoices/${id}/email`, { method: 'POST', body: input })
  const getInvoiceReminderPreview = (id: string, locale?: string) => $fetch<InvoiceEmailPreviewDto>(`/api/timesheets/admin/invoices/${id}/reminder-preview`, { query: { locale } })
  const sendInvoiceReminder = (id: string, input: Record<string, unknown>) => $fetch(`/api/timesheets/admin/invoices/${id}/reminder`, { method: 'POST', body: input })
  const refreshInvoiceEmailStatuses = (id: string, forceRefresh = false) => $fetch<InvoiceEmailStatusRefreshDto>(`/api/timesheets/admin/invoices/${id}/email-status`, { method: 'POST', query: forceRefresh ? { refresh: '1' } : undefined })
  const registerInvoicePayment = (id: string, input: { paidOn: string, amountMinor: number, reference?: string | null, note?: string | null }) => $fetch(`/api/timesheets/admin/invoices/${id}/payments`, { method: 'POST', body: input })
  const addInvoiceAttachment = (id: string, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return $fetch(`/api/timesheets/admin/invoices/${id}/attachments`, { method: 'POST', body })
  }
  const deleteInvoiceAttachment = (id: string, attachmentId: string) => $fetch(`/api/timesheets/admin/invoices/${id}/attachments/${attachmentId}`, { method: 'DELETE' as never })

  return {
    bootstrap,
    createEntry,
    updateEntry,
    deleteEntry,
    startTimer,
    stopTimer,
    submitWeek,
    adminBootstrap,
    createClient,
    getClientDeletionEligibility,
    deleteClient,
    updateClientAccess,
    getOrganizationTimesheetCapabilities,
    updateOrganizationTimesheetCapabilities,
    clientWorkspaces,
    clientApprovalSuppliers,
    clientReviewerSuppliers,
    clientTimesheets,
    reviewClientSlice,
    clientReviewers,
    setClientReviewer,
    updateOrganizationProfile,
    createContact,
    updateContact,
    deleteContact,
    createActivity,
    updateActivity,
    getActivityDeletionEligibility,
    deleteActivity,
    createProject,
    updateProject,
    getProjectDeletionEligibility,
    deleteProject,
    setTeamTariff,
    updateSettings,
    reviewWeek,
    getReport,
    createInvoice,
    getNextInvoiceNumber,
    getInvoice,
    updateInvoice,
    changeInvoiceStatus,
    getInvoiceEmailPreview,
    issueAndSendInvoice,
    resendInvoice,
    getInvoiceReminderPreview,
    sendInvoiceReminder,
    refreshInvoiceEmailStatuses,
    registerInvoicePayment,
    addInvoiceAttachment,
    deleteInvoiceAttachment
  }
}
