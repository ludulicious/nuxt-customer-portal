<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import type { PublicPortalSettings } from '../composables/usePortalSettings'

definePageMeta({ layout: 'portal', public: true })
const { locale } = useI18n()
const settings = useState<PublicPortalSettings | null>('portal-runtime-settings')
const page = computed(() => (settings.value?.content?.[locale.value as 'en' | 'nl'] || settings.value?.content?.en)?.terms)
useSeoMeta({ title: () => page.value?.title || 'Terms' })
</script>

<template><article v-if="page" class="legal-page"><p class="eyebrow">Legal</p><h1>{{ page.title }}</h1><div>{{ page.body }}</div></article></template>

<style scoped>.legal-page{max-width:52rem;margin:0 auto;padding:clamp(2rem,7vw,6rem) 1rem}.legal-page h1{font-size:clamp(2.5rem,7vw,5rem);font-weight:850;overflow-wrap:anywhere;margin-bottom:3rem}.legal-page div{white-space:pre-wrap;line-height:1.75;color:var(--ui-text-muted)}.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:.75rem;font-weight:800;color:var(--portal-primary)}</style>
