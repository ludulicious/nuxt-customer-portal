import { formatAppointmentRange, formatAppointmentTime } from '@nuxt-customer-portal/core/shared/appointment-time'

export function usePlanningTimeDisplay() {
  const { t } = useI18n()
  const browserLocale = ref<string[]>()
  onMounted(() => {
    browserLocale.value = [...navigator.languages]
  })
  const options = (timeZone: string) => ({ locale: browserLocale.value, timeZone, midnight: t('planning.midnight') })
  return {
    appointmentTime: (value: string | Date, timeZone: string) => formatAppointmentTime(value, options(timeZone)),
    appointmentRange: (start: string | Date, end: string | Date, timeZone: string) =>
      formatAppointmentRange(start, end, options(timeZone))
  }
}
