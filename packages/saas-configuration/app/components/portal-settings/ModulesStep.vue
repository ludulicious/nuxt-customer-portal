<script setup lang="ts">
import type { PortalModuleId, PortalSettings } from '../../../shared/settings'
import { portalModuleIds } from '../../../shared/settings'

const state = defineModel<PortalSettings>({ required: true })
const { t } = useI18n()
const modules = computed<Record<PortalModuleId, { label: string, description: string, icon: string }>>(() => ({
  'timesheets': { label: t('saasSettings.editor.modules.timesheets'), description: t('saasSettings.editor.modules.timesheetsDescription'), icon: 'i-lucide-clock-3' },
  'invoices': { label: t('saasSettings.editor.modules.invoices'), description: t('saasSettings.editor.modules.invoicesDescription'), icon: 'i-lucide-receipt-text' },
  'service-requests': { label: t('saasSettings.editor.modules.serviceRequests'), description: t('saasSettings.editor.modules.serviceRequestsDescription'), icon: 'i-lucide-messages-square' },
  'invoice-timesheets': { label: t('saasSettings.editor.modules.invoiceTimesheets'), description: t('saasSettings.editor.modules.invoiceTimesheetsDescription'), icon: 'i-lucide-workflow' }
}))
function toggle(moduleId: PortalModuleId, enabled: boolean) {
  state.value.enabledModules = enabled ? [...new Set([...state.value.enabledModules, moduleId])] : state.value.enabledModules.filter(value => value !== moduleId)
}
</script>

<template><UFormField name="enabledModules"><div class="module-list"><label v-for="moduleId in portalModuleIds" :key="moduleId" class="module-option"><UIcon :name="modules[moduleId].icon" class="module-option__icon" /><span><strong>{{ modules[moduleId].label }}</strong><small>{{ modules[moduleId].description }}</small><small class="module-option__preserved">{{ t('saasSettings.editor.modules.preserved') }}</small></span><USwitch :model-value="state.enabledModules.includes(moduleId)" @update:model-value="toggle(moduleId, $event)" /></label></div></UFormField></template>

<style scoped>.module-list{display:grid;gap:1.25rem}.module-option{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:1rem;padding:1rem;border:1px solid var(--ui-border);border-radius:.65rem}.module-option__icon{width:1.5rem;height:1.5rem;color:var(--ui-primary)}.module-option span{display:grid;gap:.2rem}.module-option small{color:var(--ui-text-muted)}.module-option__preserved{font-size:.7rem}@media(max-width:480px){.module-option{grid-template-columns:auto minmax(0,1fr)}.module-option :deep(button){grid-column:2;justify-self:start}}</style>
