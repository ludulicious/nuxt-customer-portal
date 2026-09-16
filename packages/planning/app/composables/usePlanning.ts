import type { Slot, AvailabilityWindow, PlanningPolicy, ProviderSettings } from '../../shared/types'

export interface HoldResult {
  holdToken: string
  expiresAt: string
  start: string
  end: string
  providerName: string
  amount: number
  currency: string
}
export interface AppointmentDetails {
  id: string
  productId: string
  productSlug: string
  title: string
  providerName: string
  start: string
  end: string
  status: 'confirmed' | 'cancelled'
  customerTimezone: string
  currency: string
  meetingUrl: string | null
  changes: number
  freeChanges: number
  changeFee: number | null
  pendingChangeExpiresAt: string | null
  staff: boolean
  canManage: boolean
  revision: number
  canReschedule: boolean
  canCancel: boolean
  refundAmount: number
  conflict: boolean
}
export interface ProviderConfiguration {
  enabled: boolean
  timezone: string
  graceMinutes: number
  busyCalendarIds: string[]
  writeCalendarId: string | null
  connections: Array<{ provider: string; healthy: boolean; error: string | null }>
  products: Array<{ id: string; title: string; thumbnailImageId: string | null }>
}
export interface AppointmentListItem {
  id: string
  title: string
  start: string
  end: string
  status: string
  providerName?: string
  customerTimezone?: string
  conflict?: boolean
  effectsError?: string
  email?: string
  customerName?: string
  country?: string
}
export interface CalendarBusyPeriod {
  start: string
  end: string
  title?: string
  allDay?: boolean
  startDate?: string
  endDate?: string
}
export const usePlanning = () => ({
  available: (id: string, query: Record<string, unknown>, replacesId?: string) =>
    $fetch<Slot[]>(
      replacesId ? `/api/planning/appointments/${replacesId}/availability` : `/api/store/planning/${id}/availability`,
      { query }
    ),
  reserve: (body: Record<string, unknown>) => $fetch<HoldResult>('/api/store/planning/holds', { method: 'POST', body }),
  bookableProducts: () => $fetch<Array<{ slug: string; title: string }>>('/api/planning/products'),
  provider: () => $fetch<ProviderConfiguration>('/api/planning/provider'),
  saveProvider: (body: Record<string, unknown>) =>
    $fetch<ProviderConfiguration>('/api/planning/provider', { method: 'PUT', body }),
  calendars: () => $fetch<Array<{ id: string; summary: string; accessRole: string }>>('/api/planning/calendars'),
  calendarBusy: (query: { from: string; to: string }) =>
    $fetch<CalendarBusyPeriod[]>('/api/planning/calendar-busy', { query }),
  connect: (provider: string) => $fetch<{ url: string }>(`/api/planning/oauth/${provider}/start`, { method: 'POST' }),
  disconnect: (provider: string) => $fetch(`/api/planning/oauth/${provider}`, { method: 'DELETE' }),
  windows: () => $fetch<AvailabilityWindow[]>('/api/planning/availability'),
  saveWindow: (body: Record<string, unknown>, id?: string) =>
    $fetch<AvailabilityWindow>(id ? `/api/planning/availability/${id}` : '/api/planning/availability', {
      method: id ? 'PUT' : 'POST',
      body
    }),
  deleteWindow: (id: string, occurrence?: string) =>
    $fetch(`/api/planning/availability/${id}`, { method: 'DELETE', query: { occurrence } }),
  providerAppointments: () => $fetch<AppointmentListItem[]>('/api/planning/provider-appointments'),
  providers: () => $fetch<ProviderSettings[]>('/api/planning/admin/providers'),
  setEnabled: (id: string, enabled: boolean) =>
    $fetch(`/api/planning/admin/providers/${id}`, { method: 'PATCH', body: { enabled } }),
  policy: () => $fetch<PlanningPolicy>('/api/planning/admin/policy'),
  savePolicy: (body: PlanningPolicy) => $fetch<PlanningPolicy>('/api/planning/admin/policy', { method: 'PUT', body }),
  appointments: (query: Record<string, unknown> = {}, signal?: AbortSignal) =>
    $fetch<{
      items: AppointmentListItem[]
      pagination: { total: number; page: number; pageSize: number; pageCount: number }
      access: { staff: boolean; canManage: boolean }
    }>('/api/planning/appointments', { query, signal }),
  staffReschedule: (id: string, body: Record<string, unknown>) =>
    $fetch(`/api/planning/appointments/${id}/reschedule`, { method: 'PUT', body }),
  appointment: (id: string) => $fetch<AppointmentDetails>(`/api/planning/appointments/${id}`),
  abandonChange: (id: string) => $fetch(`/api/planning/appointments/${id}/pending`, { method: 'DELETE' }),
  cancel: (id: string) => $fetch(`/api/planning/appointments/${id}/cancel`, { method: 'POST' }),
  adminAppointments: () => $fetch<AppointmentListItem[]>('/api/planning/admin/appointments'),
  jobs: () =>
    $fetch<Array<{ id: string; kind: string; attempts: number; error: string | null }>>('/api/planning/admin/jobs'),
  retry: () => $fetch('/api/planning/admin/retry', { method: 'POST' })
})
