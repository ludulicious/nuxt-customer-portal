<script setup lang="ts">
import { en, nl } from '@nuxt/ui/locale'

const { locale } = useI18n()
const uiLocale = computed(() => locale.value === 'nl' ? nl : en)
useHead({ titleTemplate: title => title ? `${title} / Brutal Works` : 'Brutal Works', htmlAttrs: { lang: locale.value }, meta: [{ name: 'theme-color', content: '#f3ff3b' }] })
</script>

<template>
  <UApp :locale="uiLocale">
    <NuxtLoadingIndicator color="#111111" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
