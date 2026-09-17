import type { PlanningPolicy } from '@nuxt-customer-portal/products/shared/planning'

export type { PlanningPolicy, ProductPlanning } from '@nuxt-customer-portal/products/shared/planning'
export interface Interval {
  start: string
  end: string
}
export interface AvailabilityWindow {
  id: string
  userId: string
  timezone: string
  date: string
  endDate: string | null
  startTime: string
  endTime: string
  recurring: boolean
  productIds: string[] | null
  exceptions: string[]
}
export interface Slot extends Interval {
  providerUserId: string
  providerName: string
}
export interface AppointmentSnapshot {
  organizerEmail?: string
  title: string
  durationMinutes: number
  graceMinutes: number
  timezone: string
  customerTimezone: string
  policy: PlanningPolicy
  currency: string
  unitAmount: number
  meetingProvider: 'none' | 'zoom'
  customerNotificationRevision?: number
  zoomLinkNotificationPending?: boolean
  locale: 'en' | 'nl'
}
export interface Reservation {
  id: string
  store_id: string
  user_id: string
  product_id: string
  token_hash: string
  start_at: Date
  end_at: Date
  blocked_until: Date
  confirmed_at: Date | null
  expires_at: Date
  status: 'reserved' | 'confirmed' | 'expired' | 'cancelled' | 'superseded'
  order_id: string | null
  replaces_id: string | null
  snapshot: AppointmentSnapshot
}
export interface Appointment {
  id: string
  store_id: string
  reservation_id: string
  order_line_id: string
  order_id: string
  user_id: string
  product_id: string
  start_at: Date
  end_at: Date
  status: 'confirmed' | 'cancelled'
  changes: number
  revision: number
  snapshot: AppointmentSnapshot
  meeting_id: string | null
  meeting_url: string | null
  calendar_event_id: string | null
  calendar_id: string | null
  calendar_user_id: string | null
  conflict: boolean
  effects_error: string | null
}
export interface ProviderSettings {
  userId: string
  name: string
  enabled: boolean
  timezone: string
  graceMinutes: number
  availabilityCalendarTitle: string
  busyCalendarIds: string[]
  writeCalendarId: string | null
  googleConnected: boolean
  zoomConnected: boolean
}

export interface PlanningDashboardAppointment {
  id: string
  title: string
  start: string
  end: string
  meetingProvider: 'none' | 'zoom'
  meetingUrl: string | null
  providerName: string
  providerTimezone: string
  customerName: string
  customerTimezone: string
  conflict: boolean
}

export interface PlanningDashboardDto {
  access: { staff: boolean; canManage: boolean }
  upcomingCount: number
  todayCount: number
  conflictCount: number
  appointments: PlanningDashboardAppointment[]
}
