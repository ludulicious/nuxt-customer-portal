<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import type { PublicPortalSettings } from '@nuxt-customer-portal/saas-configuration/shared/settings'

definePageMeta({ layout: 'portal', public: true })
const { locale } = useI18n()
const settings = useState<PublicPortalSettings | null>('portal-runtime-settings')
const page = computed(
  () => (settings.value?.content?.[locale.value as 'en' | 'nl'] || settings.value?.content?.en)?.privacy
)
useSeoMeta({ title: () => page.value?.title || 'Privacy' })
</script>

<template>
  <PortalLegalContent v-if="page" :title="page.title" :body="page.body" />
</template>
