<script setup lang="ts">
import type { PortalSettings } from '../../../shared/settings'

const state = defineModel<PortalSettings>({ required: true })
const locale = ref<'en' | 'nl'>('en')
const { t } = useI18n()
const section = computed(() => state.value.content[locale.value])
function addFeature() {
  section.value.home.features.push({ title: '', description: '', visible: true })
}
</script>

<template>
  <div class="content-editor">
    <div class="locale-tabs"><UButton v-for="code in (['en', 'nl'] as const)" :key="code" type="button" :variant="locale === code ? 'solid' : 'outline'" @click="locale = code">{{ code.toUpperCase() }}</UButton></div>
    <UFormField :name="`content.${locale}.home.heroTitle`" :label="t('saasSettings.editor.fields.heroTitle')"><UInput v-model="section.home.heroTitle" class="w-full" /></UFormField>
    <UFormField :name="`content.${locale}.home.heroDescription`" :label="t('saasSettings.editor.fields.heroDescription')"><UTextarea v-model="section.home.heroDescription" :rows="4" class="w-full" /></UFormField>
    <div class="settings-grid"><UFormField :name="`content.${locale}.home.heroActionLabel`" :label="t('saasSettings.editor.fields.actionLabel')"><UInput v-model="section.home.heroActionLabel" class="w-full" /></UFormField><UFormField :name="`content.${locale}.home.heroActionUrl`" :label="t('saasSettings.editor.fields.actionUrl')"><UInput v-model="section.home.heroActionUrl" class="w-full" /></UFormField></div>
    <UFormField :name="`content.${locale}.home.introductionTitle`" :label="t('saasSettings.editor.fields.introductionTitle')"><UInput v-model="section.home.introductionTitle" class="w-full" /></UFormField>
    <UFormField :name="`content.${locale}.home.introductionBody`" :label="t('saasSettings.editor.fields.introduction')"><UTextarea v-model="section.home.introductionBody" :rows="5" class="w-full" /></UFormField>
    <div v-for="(feature, index) in section.home.features" :key="index" class="feature-editor"><UFormField :name="`content.${locale}.home.features.${index}.title`"><UInput v-model="feature.title" :placeholder="t('saasSettings.editor.featureTitle')" /></UFormField><UFormField :name="`content.${locale}.home.features.${index}.description`"><UTextarea v-model="feature.description" :placeholder="t('saasSettings.editor.featureDescription')" /></UFormField><USwitch v-model="feature.visible" /><UButton type="button" icon="i-lucide-trash-2" color="neutral" variant="ghost" @click="section.home.features.splice(index, 1)" /></div>
    <UButton v-if="section.home.features.length < 6" type="button" icon="i-lucide-plus" color="neutral" variant="outline" @click="addFeature">{{ t('saasSettings.editor.actions.addFeature') }}</UButton>
    <UFormField :name="`content.${locale}.home.supportTitle`" :label="t('saasSettings.editor.fields.supportTitle')"><UInput v-model="section.home.supportTitle" class="w-full" /></UFormField>
    <UFormField :name="`content.${locale}.home.supportBody`" :label="t('saasSettings.editor.fields.supportText')"><UTextarea v-model="section.home.supportBody" class="w-full" /></UFormField>
    <UCheckbox v-model="section.home.supportVisible" :label="t('saasSettings.editor.showSupport')" />
  </div>
</template>

<style scoped>.content-editor{display:grid;gap:1.25rem}.locale-tabs{display:flex;gap:.5rem}.settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.25rem}.feature-editor{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr) auto auto;gap:.75rem;align-items:center;padding:1rem;background:var(--ui-bg-muted);border-radius:.65rem}@media(max-width:768px){.settings-grid,.feature-editor{grid-template-columns:1fr}}</style>
