export default defineNuxtRouteMiddleware(async (to) => {
  if (
    to.meta.public ||
    to.path === '/personal-onboarding' ||
    !useClientConfiguration().value.personalSelfRegistration
  ) {
    return
  }
  const request = useRequestFetch()
  const status = await request<{ onboardingRequired: boolean }, string>('/api/personal-client')
  if (status.onboardingRequired) {
    return navigateTo('/personal-onboarding')
  }
})
