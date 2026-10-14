import type { ClientReviewInterval } from '../client-review-periods'

export interface ReviewEntrySnapshot {
  id: string
  date: string
  weekStartsOn: string
  personId: string
  person: string
  project: string
  activity: string
  minutes: number
  note: string | null
  billable: boolean
  rate: number
  currency: string
  submissionId: string
}
export interface ClientReviewRequestDto {
  id: string
  workspaceClientId: string
  clientName: string
  supplierName: string
  startsOn: string
  endsOn: string
  revision: number
  status: 'PENDING' | 'APPROVED' | 'DISPUTED' | 'WITHDRAWN'
  version: number
  supplementary: boolean
  replacesId: string | null
  replacesIds: string[]
  message: string | null
  entries: Array<
    Omit<ReviewEntrySnapshot, 'billable' | 'rate' | 'currency'> &
      Partial<Pick<ReviewEntrySnapshot, 'billable' | 'rate' | 'currency'>>
  >
  history: Array<{ action: string; actor: string; actorId: string; comment: string | null; createdAt: string }>
}
export interface ClientReviewPeriodDto {
  workspaceClientId: string
  clientName: string
  startsOn: string
  endsOn: string
  interval: ClientReviewInterval
  totalMinutes: number
  outstandingEntries: Array<{ id: string; date: string; person: string }>
  outstandingCount: number
  availableCount: number
  hasReviewers: boolean
  canSend: boolean
}

export interface ClientTimesheetSettingsDto {
  accessMode: 'DISABLED' | 'VIEW' | 'REVIEW'
  reviewInterval: ClientReviewInterval
  scheduledReviewInterval: ClientReviewInterval | null
  reviewIntervalEffectiveOn: string | null
  reviewStartsOn: string
}
