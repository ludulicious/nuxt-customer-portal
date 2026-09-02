import { TIMESHEET_ERROR_CODES } from '@nuxt-customer-portal/timesheets/shared/timesheet-errors'

type ApiErrorShape = {
  data?: { code?: string; data?: { code?: string } }
  message?: string
}

export const useTimesheetMutationError = () => {
  const { t } = useI18n()
  const toast = useToast()

  const codeFor = (error: unknown) => {
    const value = error as ApiErrorShape
    return value?.data?.code ?? value?.data?.data?.code
  }

  const show = (error: unknown, titleKey = 'features.timesheets.messages.saveError') => {
    const code = codeFor(error)
    const descriptionKey =
      code === TIMESHEET_ERROR_CODES.tariffRequired
        ? 'features.timesheets.errors.tariffRequired'
        : code === TIMESHEET_ERROR_CODES.entryDisabled
          ? 'features.timesheets.errors.entryDisabled'
          : code === TIMESHEET_ERROR_CODES.runningTimer
            ? 'features.timesheets.errors.runningTimer'
            : code === TIMESHEET_ERROR_CODES.internalApproverRequired
              ? 'features.timesheets.errors.internalApproverRequired'
              : 'features.timesheets.errors.generic'
    toast.add({ title: t(titleKey), description: t(descriptionKey), color: 'error' })
  }

  return { codeFor, show }
}
