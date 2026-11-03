import type { PortalEmailSettings } from '../types/admin-email'

export const useAdminEmailSettings = async () => {
  const { t } = useI18n()
  const route = useRoute()
  const { isAdmin } = storeToRefs(useUserStore())
  if (!isAdmin.value) {
    throw createError({ statusCode: 403, message: t('admin.errors.accessRequired') })
  }
  const result = await useFetch<PortalEmailSettings, import('#app').NuxtError<unknown>, string>('/api/admin/email')
  if (result.error.value) {
    if (result.error.value.statusCode === 401) {
      await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
    } else {
      throw createError(result.error.value)
    }
  }
  return result
}
