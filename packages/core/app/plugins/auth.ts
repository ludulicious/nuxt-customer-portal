import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'
import type { AuthSessionResponse } from '@nuxt-customer-portal/core/app/utils/auth-client'

export default defineNuxtPlugin({
  name: 'auth',
  async setup() {
    const userStore = useUserStore()
    try {
      const { data: session } = await authClient.useSession(useFetch)
      await userStore.setSession(session.value as unknown as AuthSessionResponse | null)

      // Reuse the same reactive request used by route middleware. Fetching a
      // separate getSession() first downloads the session twice during startup.
      watch(
        () => session.value,
        async (newSession) => {
          await userStore.setSession(newSession as unknown as AuthSessionResponse | null)
        },
        { deep: true }
      )
    } catch (error) {
      console.log('getSession error:', error)
    }
  }
})
