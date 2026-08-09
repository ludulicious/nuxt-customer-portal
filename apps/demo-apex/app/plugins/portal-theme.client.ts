import { isPortalThemeName, resolvePortalThemeName } from '../themes/portal-theme'

export default defineNuxtPlugin(() => {
  watchEffect(() => {
    const configuredTheme = useAppConfig().portal.theme
    const themeName = resolvePortalThemeName(configuredTheme)

    if (import.meta.dev && !isPortalThemeName(configuredTheme)) {
      console.warn(`[portal-theme] Unknown theme "${String(configuredTheme)}". Falling back to "apex".`)
    }

    document.documentElement.dataset.portalTheme = themeName
  })
})
