<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import type { PublicPortalSettings } from '../composables/usePortalSettings'

definePageMeta({ layout: 'portal', public: true })
const { locale } = useI18n()
const settings = useState<PublicPortalSettings | null>('portal-runtime-settings')
const content = computed(() => settings.value?.content?.[locale.value as 'en' | 'nl'] || settings.value?.content?.en)
useSeoMeta({ title: () => content.value?.home.heroTitle || settings.value?.branding?.portalName || 'Customer Portal' })
</script>

<template>
  <main v-if="content" class="public-home">
    <section class="public-hero"><div><p class="eyebrow">{{ settings?.branding?.tagline }}</p><h1>{{ content.home.heroTitle }}</h1><p>{{ content.home.heroDescription }}</p><UButton v-if="content.home.heroActionLabel" :to="content.home.heroActionUrl || '/login'" size="xl" trailing-icon="i-lucide-arrow-right">{{ content.home.heroActionLabel }}</UButton></div><aside><PublicPortalLogo /><p v-if="settings?.branding?.supportEmail">{{ settings.branding.supportEmail }}</p></aside></section>
    <section class="public-intro"><h2>{{ content.home.introductionTitle }}</h2><p>{{ content.home.introductionBody }}</p></section>
    <section v-if="content.home.features.some((item:any) => item.visible)" class="public-features"><article v-for="(feature, index) in content.home.features.filter((item:any) => item.visible)" :key="index"><span>0{{ Number(index) + 1 }}</span><h3>{{ feature.title }}</h3><p>{{ feature.description }}</p></article></section>
    <section v-if="content.home.supportVisible" class="public-support"><h2>{{ content.home.supportTitle }}</h2><p>{{ content.home.supportBody }}</p><UButton v-if="settings?.branding?.supportUrl" :to="settings.branding.supportUrl" color="neutral" variant="outline">Contact support</UButton></section>
  </main>
</template>

<style scoped>
/* Hallmark · genre: modern-minimal · macrostructure: split masthead + numbered ledger · theme: portal-native
 * pre-emit critique: P5 H5 E4 S5 R5 V5 · mobile: pass (34,49–57)
 */
.public-home{padding:clamp(1rem,4vw,4rem);display:grid;gap:clamp(3rem,8vw,7rem);overflow-x:clip}.public-hero{min-height:34rem;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(16rem,.5fr);gap:3rem;align-items:end;border-bottom:1px solid var(--ui-border);padding-bottom:3rem}.public-hero h1{font-size:clamp(3rem,8vw,7.5rem);line-height:.92;letter-spacing:-.06em;font-weight:900;max-width:12ch;overflow-wrap:anywhere}.public-hero p{max-width:45rem;font-size:1.15rem;color:var(--ui-text-muted);margin:1.5rem 0}.public-hero aside{align-self:start;display:grid;gap:1rem;justify-items:start;padding-top:1rem}.eyebrow{text-transform:uppercase;letter-spacing:.14em;font-size:.75rem;font-weight:800;color:var(--portal-primary)!important}.public-intro{display:grid;grid-template-columns:minmax(0,.65fr) minmax(0,1.35fr);gap:3rem}.public-intro h2,.public-support h2{font-size:clamp(2rem,5vw,4rem);font-weight:800;overflow-wrap:anywhere}.public-intro p,.public-support p{font-size:1.2rem;white-space:pre-line;color:var(--ui-text-muted)}.public-features{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--ui-border)}.public-features article{padding:1.5rem;border-right:1px solid var(--ui-border)}.public-features span{font-variant-numeric:tabular-nums;color:var(--portal-primary);font-weight:800}.public-features h3{font-size:1.4rem;font-weight:750;margin:.75rem 0}.public-features p{color:var(--ui-text-muted)}.public-support{display:grid;gap:1.25rem;max-width:48rem;padding-bottom:3rem}@media(max-width:768px){.public-hero,.public-intro{grid-template-columns:1fr;min-height:auto}.public-hero{align-items:start}.public-features{grid-template-columns:1fr}.public-features article{border-right:0;border-bottom:1px solid var(--ui-border)}}
</style>
