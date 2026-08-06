export const TIMESHEET_ERROR_CODES = {
  tariffRequired: 'TIMESHEET_TARIFF_REQUIRED',
  entryDisabled: 'TIMESHEET_ENTRY_DISABLED',
  runningTimer: 'TIMESHEET_RUNNING_TIMER'
} as const

export type TimesheetErrorCode = typeof TIMESHEET_ERROR_CODES[keyof typeof TIMESHEET_ERROR_CODES]
