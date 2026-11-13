<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'
import type { PortalSettings } from '@nuxt-customer-portal/saas-configuration/shared/settings'
import { resolvePortalTheme } from '@nuxt-customer-portal/saas-configuration/shared/theme'

const { locale } = useI18n()
const colorMode = useColorMode()
const settings = useState<Pick<PortalSettings, 'branding' | 'appearance'> | null>('portal-runtime-settings')
const theme = computed(() => resolvePortalTheme(settings.value?.appearance?.theme))
const uiLocale = computed(() => (locale.value === 'nl' ? nl : en))

const defaultMarks = {
  light: '/images/portalnuxt-logo-light.webp',
  dark: '/images/portalnuxt-logo-dark.webp'
}
const compactIcons = computed(() => {
  const branding = settings.value?.branding
  // The app supplies default marks for compact UI; keep the original favicons for those.
  const light = branding?.markLight === defaultMarks.light ? '' : branding?.markLight
  const dark = branding?.markDark === defaultMarks.dark ? '' : branding?.markDark
  return {
    light: light || dark || '/favicon-light.png',
    dark: dark || light || '/favicon-dark.png',
    touch: light || dark || '/apple-touch-icon.png'
  }
})

watchEffect(() => {
  const branding = settings.value?.branding
  if (!branding) {
    return
  }

  if (!branding.markLight) {
    branding.markLight = defaultMarks.light
  }
  if (!branding.markDark) {
    branding.markDark = defaultMarks.dark
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
    {
      rel: 'icon',
      href: compactIcons.value.light,
      media: '(prefers-color-scheme: light)'
    },
    {
      rel: 'icon',
      href: compactIcons.value.dark,
      media: '(prefers-color-scheme: dark)'
    },
    { rel: 'apple-touch-icon', href: compactIcons.value.touch }
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
      <DemoBanner />
      <NuxtLoadingIndicator />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </UTheme>
</template>
