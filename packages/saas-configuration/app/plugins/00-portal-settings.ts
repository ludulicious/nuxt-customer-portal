import { appearanceStylesheet } from '../../shared/appearance'

export default defineNuxtPlugin(async () => {
  const { settings, refreshPublicSettings } = usePortalSettings()
  await refreshPublicSettings().catch(() => null)
  const colorMode = useColorMode()
  watch(
    () => settings.value?.appearance.colorMode,
    (policy) => {
      if (policy === 'light-only') {
        colorMode.preference = 'light'
      }
      if (policy === 'dark-only') {
        colorMode.preference = 'dark'
      }
    },
    { immediate: true }
  )

  useHead(() => {
    const appearance = settings.value?.appearance
    if (!appearance) {
      return {}
    }
    return {
      htmlAttrs: {
        'data-portal-theme': appearance.theme,
        'data-portal-shape': appearance.shape,
        'data-portal-heading-font': appearance.headingFont,
        'data-portal-body-font': appearance.bodyFont,
        'data-portal-surfaces':
          appearance.backgroundLight || appearance.backgroundDark || appearance.surfaceLight || appearance.surfaceDark
            ? 'custom'
            : 'theme'
      },
      style: [{ key: 'portal-primary-colors', innerHTML: appearanceStylesheet(appearance) }]
    }
  })
})
