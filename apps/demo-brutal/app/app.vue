<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'

const { locale } = useI18n()
const uiLocale = computed(() => locale.value === 'nl' ? nl : en)
useHead({
  titleTemplate: title => title ? `${title} / Brutal Works` : 'Brutal Works',
  htmlAttrs: { lang: locale.value, 'data-portal-theme': 'brutal' },
  meta: [{ name: 'theme-color', content: 'oklch(96.5% 0.015 85)' }]
})
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLoadingIndicator color="oklch(48% 0.22 28)" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
