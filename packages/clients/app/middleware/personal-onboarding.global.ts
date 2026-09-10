import { authClient } from '@nuxt-customer-portal/core/app/utils/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  if (
    to.meta.public ||
    to.path === '/personal-onboarding' ||
    !useClientConfiguration().value.personalSelfRegistration
  ) {
    return
  }
  const { data: session } = await authClient.useSession(useFetch)
  if (!session.value?.user.emailVerified) {
    return
  }
  const request = useRequestFetch()
  const status = await request<{ onboardingRequired: boolean }>('/api/personal-client')
  if (status.onboardingRequired) {
    return navigateTo('/personal-onboarding')
  }
})
