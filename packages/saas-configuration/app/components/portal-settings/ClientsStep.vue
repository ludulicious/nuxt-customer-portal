<script setup lang="ts">
import type { PortalSettings } from '../../../shared/settings'

const state = defineModel<PortalSettings>({ required: true })
const { t } = useI18n()
const openRegistration = useRuntimeConfig().public.portalAuth.registrationMode === 'open'
function toggle(type: 'organization' | 'person', enabled: boolean) {
  state.value.clients.allowedTypes = enabled
    ? [...new Set([...state.value.clients.allowedTypes, type])]
    : state.value.clients.allowedTypes.filter((value) => value !== type)
  if (!state.value.clients.allowedTypes.includes('person')) {
    state.value.clients.personalSelfRegistration = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-muted">{{ t('saasSettings.editor.clients.description') }}</p>
    <UFormField
      name="clients.allowedTypes"
      :label="t('saasSettings.editor.clients.allowedTypes')"
      :description="t('saasSettings.editor.clients.existing')"
    >
      <div class="mt-3 space-y-3">
        <UCheckbox
          id="portal-client-organizations"
          :model-value="state.clients.allowedTypes.includes('organization')"
          :label="t('saasSettings.editor.clients.organization')"
          @update:model-value="toggle('organization', $event === true)"
        />
        <UCheckbox
          id="portal-client-persons"
          :model-value="state.clients.allowedTypes.includes('person')"
          :label="t('saasSettings.editor.clients.person')"
          @update:model-value="toggle('person', $event === true)"
        />
      </div>
    </UFormField>
    <UFormField
      name="clients.personalSelfRegistration"
      :description="t('saasSettings.editor.clients.registrationDescription')"
    >
      <USwitch
        v-model="state.clients.personalSelfRegistration"
        :label="t('saasSettings.editor.clients.registration')"
        :disabled="!openRegistration || !state.clients.allowedTypes.includes('person')"
      />
    </UFormField>
    <UAlert v-if="!openRegistration" color="warning" :title="t('saasSettings.editor.clients.registrationDisabled')" />
  </div>
</template>
