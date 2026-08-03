<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'

const colorMode = useColorMode()
const { locale } = useI18n()
const uiLocale = computed(() => locale.value === 'nl' ? nl : en)

// Dynamic theme color based on current mode
const color = computed(() => {
  if (colorMode.value === 'dark') {
    return '#0a0f1a' // Deep space background
  }
  return '#ffffff' // Enhanced vibrant background
})

// Enhanced meta tags for cosmic theme
useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color },
    { name: 'color-scheme', content: 'light dark' },
    { name: 'msapplication-TileColor', content: color }
  ],
  link: [
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }
  ],
  htmlAttrs: {
    lang: locale,
    class: computed(() => colorMode.value)
  }
})

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
  <UApp :locale="uiLocale">
    <NuxtLoadingIndicator />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
