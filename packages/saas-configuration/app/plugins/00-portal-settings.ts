import { primaryForeground } from '../../shared/primary-contrast'

export default defineNuxtPlugin(async () => {
  const { refreshPublicSettings } = usePortalSettings()
  const settings = await refreshPublicSettings().catch(() => null)
  if (!settings) {
    return
  }
  const colorMode = useColorMode()
  if (settings.appearance.colorMode === 'light-only') {
    colorMode.preference = 'light'
  }
  if (settings.appearance.colorMode === 'dark-only') {
    colorMode.preference = 'dark'
  }

  useHead(() => ({
    htmlAttrs: { 'data-portal-theme': settings.appearance.theme },
    style: [
      {
        key: 'portal-primary-colors',
        innerHTML: `:root{--portal-primary:${settings.appearance.primaryLight};--portal-on-primary:${primaryForeground(settings.appearance.primaryLight)};--ui-primary:${settings.appearance.primaryLight};--color-primary-500:${settings.appearance.primaryLight};--color-primary-600:${settings.appearance.primaryLight}}html.dark{--portal-primary:${settings.appearance.primaryDark};--portal-on-primary:${primaryForeground(settings.appearance.primaryDark)};--ui-primary:${settings.appearance.primaryDark};--color-primary-500:${settings.appearance.primaryDark};--color-primary-600:${settings.appearance.primaryDark}}`
      }
    ]
  }))
})
