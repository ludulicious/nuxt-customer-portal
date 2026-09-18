<script setup lang="ts">
import type { PortalSettings } from '../../../shared/settings'

const state = defineModel<PortalSettings>({ required: true })
const { t } = useI18n()
</script>

<template>
  <div class="settings-grid">
    <UFormField name="branding.portalName" required :label="t('saasSettings.editor.fields.portalName')">
      <UInput v-model="state.branding.portalName" class="w-full" />
    </UFormField>
    <UFormField name="branding.tagline" :label="t('saasSettings.editor.fields.tagline')">
      <UInput v-model="state.branding.tagline" class="w-full" />
    </UFormField>
    <UFormField name="branding.supportEmail" :label="t('saasSettings.editor.fields.supportEmail')">
      <UInput v-model="state.branding.supportEmail" type="email" class="w-full" />
    </UFormField>
    <UFormField name="branding.supportUrl" :label="t('saasSettings.editor.fields.supportUrl')">
      <UInput v-model="state.branding.supportUrl" class="w-full" />
    </UFormField>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.25rem;
}
@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
