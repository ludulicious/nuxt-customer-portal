import { demoMessage } from '@nuxt-customer-portal/core/shared/demo-policy'

export default defineNuxtPlugin((nuxtApp) => {
  if (!useRuntimeConfig().public.portalDemo?.enabled) {
    return
  }
  const toast = useToast()
  const originalFetch = globalThis.fetch
  // Both Better Auth and $fetch use the native transport. Observe responses so
  // existing dialogs retain their validation and always show the demo explanation.
  globalThis.fetch = async (...args) => {
    const response = await originalFetch(...args)
    if (response.status === 403) {
      const body = await response
        .clone()
        .json()
        .catch(() => null)
      if (body?.code === 'DEMO_RESTRICTED' || body?.data?.code === 'DEMO_RESTRICTED') {
        toast.add({ id: 'demo-restricted', title: demoMessage(nuxtApp.$i18n.locale.value), color: 'warning' })
      }
    }
    return response
  }
})
