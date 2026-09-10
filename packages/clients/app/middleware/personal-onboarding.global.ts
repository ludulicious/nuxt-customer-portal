export default defineNuxtRouteMiddleware(async (to) => {
  if (
    to.meta.public ||
    to.path === '/personal-onboarding' ||
    !useClientConfiguration().value.personalSelfRegistration
  ) {
    return
  }
  const request = useRequestFetch()
  const status = await request<{ onboardingRequired: boolean }>('/api/personal-client')
  if (status.onboardingRequired) {
    return navigateTo('/personal-onboarding')
  }
})
