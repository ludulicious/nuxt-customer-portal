<script setup lang="ts">
import { portalLanguages } from '@nuxt-customer-portal/core/shared/languages'
import type { PortalSettings } from '../../../shared/settings'

const state = defineModel<PortalSettings>({ required: true })
const { t } = useI18n()
</script>

<template>
  <UFormField
    name="languages"
    :label="t('saasSettings.editor.languages.label')"
    :help="t('saasSettings.editor.languages.help')"
  >
    <USelectMenu v-model="state.languages" :items="portalLanguages" value-key="value" multiple class="w-full sm:w-80" />
  </UFormField>
</template>
