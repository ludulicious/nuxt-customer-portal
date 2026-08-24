<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'
import { resolvePortalTheme, resolvePortalThemeName } from './themes/portal-theme'

const colorMode = useColorMode()
const appConfig = useAppConfig()
const { locale } = useI18n()
const uiLocale = computed(() => (locale.value === 'nl' ? nl : en))
const activeThemeName = computed(() => resolvePortalThemeName(appConfig.portal.theme))
const activeTheme = computed(() => resolvePortalTheme(activeThemeName.value))

const color = computed(() => {
  return activeTheme.value.browserThemeColor[colorMode.value === 'dark' ? 'dark' : 'light']
})

useHead(() => ({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color.value },
    { name: 'color-scheme', content: 'light dark' },
    { name: 'msapplication-TileColor', content: color.value }
  ],
  link: [
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
  ],
  htmlAttrs: {
    lang: locale.value,
    class: colorMode.value,
    'data-portal-theme': activeThemeName.value
  }
}))

if (import.meta.client) {
  watch(
    activeThemeName,
    (themeName) => {
      document.documentElement.dataset.portalTheme = themeName
    },
    { immediate: true }
  )
}

useSeoMeta({
  titleTemplate: '%s - ApexPro',
  ogImage: '/images/ogimage.png',
  twitterImage: '/images/ogimage.png',
  twitterCard: 'summary_large_image'
})

// Simplified navigation - no content queries to avoid server errors
const navigation = ref([])

provide('navigation', navigation)
</script>

<template>
  <UTheme :props="activeTheme.props" :ui="activeTheme.ui">
    <UApp :locale="uiLocale">
      <NuxtLoadingIndicator />
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UApp>
  </UTheme>
</template>
