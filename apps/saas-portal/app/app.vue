<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'
import type { PortalSettings } from '@nuxt-customer-portal/saas-configuration/shared/settings'
import { resolvePortalTheme } from '../../demo-apex/app/themes/portal-theme'

const { locale } = useI18n()
const colorMode = useColorMode()
const settings = useState<Pick<PortalSettings, 'branding' | 'appearance'> | null>('portal-runtime-settings')
const theme = computed(() => resolvePortalTheme(settings.value?.appearance?.theme))
const uiLocale = computed(() => (locale.value === 'nl' ? nl : en))
useHead(() => ({
  htmlAttrs: {
    lang: locale.value,
    class: colorMode.value,
    'data-portal-theme': settings.value?.appearance?.theme || 'apex'
  },
  meta: [
    {
      name: 'color-scheme',
      content:
        settings.value?.appearance?.colorMode === 'light-only'
          ? 'light'
          : settings.value?.appearance?.colorMode === 'dark-only'
            ? 'dark'
            : 'light dark'
    }
  ]
}))
useSeoMeta({
  titleTemplate: (title) =>
    title
      ? `${title} · ${settings.value?.branding?.portalName || 'Customer Portal'}`
      : settings.value?.branding?.portalName || 'Customer Portal'
})
</script>

<template>
  <UTheme :props="theme.props" :ui="theme.ui">
    <UApp :locale="uiLocale">
      <NuxtLoadingIndicator />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </UTheme>
</template>
