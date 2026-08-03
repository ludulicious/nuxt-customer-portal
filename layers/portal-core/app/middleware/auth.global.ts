import { authClient } from '#portal/app/utils/auth-client'

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.meta.public === true) return
  try {
    const { data: session } = await authClient.useSession(useFetch)

    if (!session.value) {
      console.log('No active session found, redirecting to login')
      // No active session, redirect the user to the login page
      // Preserve the original intended path via a redirect query parameter
      const redirectPath = `/login?redirect=${encodeURIComponent(to.fullPath)}`
      return navigateTo(redirectPath, {
        external: false,
        replace: true, // Use replace to avoid adding the original protected path to history
      })
    } else {
      console.log('Active session found, allowing access to:', to.path)
    }
  } catch (error) {
    console.error('Auth middleware error:', error)
    // If there's an error checking auth, redirect to login
    return navigateTo('/login', {
      external: false,
      replace: true,
    })
  }

  // User is authenticated, allow access to the protected route
})
