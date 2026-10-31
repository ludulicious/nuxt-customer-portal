<script setup lang="ts">
import type { PortalSettings } from '../../../shared/settings'

const state = defineModel<PortalSettings>({ required: true })
const locale = ref<'en' | 'nl'>('en')
const { t } = useI18n()
const section = computed(() => state.value.content[locale.value])
</script>

<template>
  <div class="content-editor">
    <div class="locale-tabs">
      <UButton
        v-for="code in ['en', 'nl'] as const"
        :key="code"
        type="button"
        :variant="locale === code ? 'solid' : 'outline'"
        @click="locale = code"
      >
        {{ code.toUpperCase() }}
      </UButton>
    </div>
    <UFormField :name="`content.${locale}.terms.title`" :label="t('saasSettings.editor.fields.termsTitle')">
      <UInput v-model="section.terms.title" class="w-full" /> </UFormField
    ><UFormField :name="`content.${locale}.terms.body`" :label="t('saasSettings.editor.fields.termsText')">
      <PortalMarkdownEditor :key="`${locale}-terms`" v-model="section.terms.body" :rows="12" /> </UFormField
    ><UFormField :name="`content.${locale}.privacy.title`" :label="t('saasSettings.editor.fields.privacyTitle')">
      <UInput v-model="section.privacy.title" class="w-full" /> </UFormField
    ><UFormField :name="`content.${locale}.privacy.body`" :label="t('saasSettings.editor.fields.privacyText')">
      <PortalMarkdownEditor :key="`${locale}-privacy`" v-model="section.privacy.body" :rows="12" />
    </UFormField>
  </div>
</template>

<style scoped>
.content-editor {
  display: grid;
  gap: 1.25rem;
}
.locale-tabs {
  display: flex;
  gap: 0.5rem;
}
</style>
