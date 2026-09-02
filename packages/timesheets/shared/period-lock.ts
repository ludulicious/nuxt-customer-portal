export const isTimesheetDateLocked = (
  date: string,
  periods: readonly { status: string; periodStartsOn: string; periodEndsOn: string }[]
) =>
  periods.some(
    (period) =>
      ['SUBMITTED', 'APPROVED'].includes(period.status) && period.periodStartsOn <= date && date <= period.periodEndsOn
  )
