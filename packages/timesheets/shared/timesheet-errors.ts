export const TIMESHEET_ERROR_CODES = {
  tariffRequired: 'TIMESHEET_TARIFF_REQUIRED',
  entryDisabled: 'TIMESHEET_ENTRY_DISABLED',
  runningTimer: 'TIMESHEET_RUNNING_TIMER',
  internalApproverRequired: 'TIMESHEET_INTERNAL_APPROVER_REQUIRED',
  internalApprovalUnauthorized: 'TIMESHEET_INTERNAL_APPROVAL_UNAUTHORIZED',
  internalApprovalStale: 'TIMESHEET_INTERNAL_APPROVAL_STALE',
  internalApprovalMemberInvalid: 'TIMESHEET_INTERNAL_APPROVAL_MEMBER_INVALID',
  internalApprovalSelfAssignment: 'TIMESHEET_INTERNAL_APPROVAL_SELF_ASSIGNMENT',
  internalApprovalDuplicateAssignment: 'TIMESHEET_INTERNAL_APPROVAL_DUPLICATE_ASSIGNMENT'
} as const

export type TimesheetErrorCode = typeof TIMESHEET_ERROR_CODES[keyof typeof TIMESHEET_ERROR_CODES]
