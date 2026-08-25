<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'
import type { PortalSettings } from '@nuxt-customer-portal/saas-configuration/shared/settings'
import { resolvePortalTheme } from '../../demo-apex/app/themes/portal-theme'

const { locale } = useI18n()
const colorMode = useColorMode()
const settings = useState<Pick<PortalSettings, 'branding' | 'appearance'> | null>('portal-runtime-settings')
const theme = computed(() => resolvePortalTheme(settings.value?.appearance?.theme))
const uiLocale = computed(() => (locale.value === 'nl' ? nl : en))

watchEffect(() => {
  const branding = settings.value?.branding
  if (!branding) {
    return
  }

  if (!branding.markLight) {
    branding.markLight = '/images/portalnuxt-logo-light.webp'
  }
  if (!branding.markDark) {
    branding.markDark = '/images/portalnuxt-logo-dark.webp'
  }
})

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
  ],
  link: [
    { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '64x64',
      href: '/favicon-light.png',
      media: '(prefers-color-scheme: light)'
    },
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '64x64',
      href: '/favicon-dark.png',
      media: '(prefers-color-scheme: dark)'
    },
    { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }
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
