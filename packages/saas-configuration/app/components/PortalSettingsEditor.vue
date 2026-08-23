<script setup lang="ts">
import type { PortalOnboardingStep, PortalSettings } from '../../shared/settings'
import { portalOnboardingSteps, portalSettingsSchema } from '../../shared/settings'

const props = defineProps<{ onboarding?: boolean }>()
const { t } = useI18n()
const { data, status, error: loadError } = await useFetch<{ settings: PortalSettings, step: PortalOnboardingStep, completed: boolean }>('/api/admin/portal-settings')
const state = ref<PortalSettings | null>(null)
const step = ref<PortalOnboardingStep>('branding')
const busy = ref(false)
const colorMode = useColorMode()
const toast = useToast()

function showError(message: string) {
  toast.add({ title: message, color: 'error' })
}

watch(data, (value) => {
  if (!value || state.value) return
  state.value = structuredClone(value.settings)
  step.value = value.step
}, { immediate: true })

watch(() => state.value?.appearance.colorMode, (policy) => {
  if (policy === 'light-only') colorMode.preference = 'light'
  if (policy === 'dark-only') colorMode.preference = 'dark'
}, { immediate: true })

const showColorModeSwitcher = computed(() => state.value?.appearance.colorMode === 'user-choice')
const primaryColorStyle = computed<Record<string, string>>(() => {
  const appearance = state.value?.appearance
  if (!appearance) return {} as Record<string, string>
  const primary = colorMode.value === 'dark' ? appearance.primaryDark : appearance.primaryLight
  return {
    '--portal-primary': primary,
    '--ui-primary': primary,
    '--color-primary-500': primary,
    '--color-primary-600': primary
  }
})
const stepIndex = computed(() => portalOnboardingSteps.indexOf(step.value))
const stepLabels = computed<Record<PortalOnboardingStep, string>>(() => ({ branding: t('saasSettings.editor.steps.branding'), modules: t('saasSettings.editor.steps.modules'), home: t('saasSettings.editor.steps.home'), legal: t('saasSettings.editor.steps.legal'), review: t('saasSettings.editor.steps.review') }))
async function save(next?: PortalOnboardingStep) {
  if (!state.value) return false
  const parsed = portalSettingsSchema.safeParse(state.value)
  if (!parsed.success) {
    showError(t('saasSettings.editor.messages.reviewSettings'))
    return false
  }
  busy.value = true
  try {
    const result = await $fetch<{ settings: PortalSettings, step: PortalOnboardingStep }>('/api/admin/portal-settings', { method: 'PUT', body: { settings: parsed.data, step: next || step.value } })
    state.value = structuredClone(result.settings)
    step.value = result.step
    await usePortalSettings().refreshPublicSettings()
    return true
  } catch {
    showError(t('saasSettings.editor.messages.saveFailed'))
    return false
  } finally {
    busy.value = false
  }
}
async function complete() {
  if (!state.value) return
  busy.value = true
  try {
    await $fetch('/api/admin/portal-settings/complete', { method: 'POST', body: { settings: state.value } })
    await Promise.all([usePortalSettings().refreshBootstrap(), usePortalSettings().refreshPublicSettings()])
    await navigateTo('/dashboard')
  } catch {
    showError(t('saasSettings.editor.messages.completeFailed'))
  } finally {
    busy.value = false
  }
}
async function submitForm() {
  if (!props.onboarding) return save()
  if (step.value === 'review') return complete()
  return save(portalOnboardingSteps[Math.min(stepIndex.value + 1, portalOnboardingSteps.length - 1)]!)
}
</script>

<template>
  <div class="settings-page" :style="primaryColorStyle">
    <div v-if="showColorModeSwitcher" class="settings-toolbar"><UColorModeButton /></div>
    <div class="settings-workbench">
    <div v-if="status === 'pending'" class="settings-state"><UIcon name="i-lucide-loader-circle" class="animate-spin" /> {{ t('saasSettings.editor.loading') }}</div>
    <UAlert v-else-if="loadError" color="error" :title="t('saasSettings.editor.unavailable')" :description="loadError.message" />
    <template v-else-if="state">
      <nav class="settings-rail" :aria-label="t('saasSettings.editor.configurationSections')"><p class="settings-rail__label">{{ props.onboarding ? t('saasSettings.editor.setupProgress') : t('saasSettings.editor.portalConfiguration') }}</p><button v-for="item in portalOnboardingSteps" :key="item" type="button" :class="['settings-step', { 'settings-step--active': step === item }]" :disabled="props.onboarding && portalOnboardingSteps.indexOf(item) > stepIndex" @click="step = item"><span>{{ portalOnboardingSteps.indexOf(item) + 1 }}</span>{{ stepLabels[item] }}</button></nav>
      <section class="settings-panel">
        <header><p class="eyebrow">{{ stepIndex + 1 }} / {{ portalOnboardingSteps.length }}</p><h1>{{ stepLabels[step] }}</h1></header>
        <UForm class="settings-form" :state="state" :schema="portalSettingsSchema" @submit="submitForm" @error="showError(t('saasSettings.editor.messages.reviewSettings'))">
          <PortalSettingsBrandingStep v-if="step === 'branding'" v-model="state" @error="showError" />
          <PortalSettingsModulesStep v-else-if="step === 'modules'" v-model="state" />
          <PortalSettingsHomeStep v-else-if="step === 'home'" v-model="state" />
          <PortalSettingsLegalStep v-else-if="step === 'legal'" v-model="state" />
          <PortalSettingsReviewStep v-else :state="state" />
          <footer class="settings-actions"><UButton v-if="stepIndex > 0" type="button" color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="step = portalOnboardingSteps[stepIndex - 1]!">{{ t('saasSettings.editor.actions.back') }}</UButton><span /><UButton v-if="!props.onboarding" type="submit" :loading="busy">{{ t('saasSettings.editor.actions.save') }}</UButton><UButton v-else-if="step !== 'review'" type="submit" :loading="busy" trailing-icon="i-lucide-arrow-right">{{ t('saasSettings.editor.actions.saveContinue') }}</UButton><UButton v-else type="submit" :loading="busy" icon="i-lucide-check">{{ t('saasSettings.editor.actions.complete') }}</UButton></footer>
        </UForm>
      </section>
    </template>
    </div>
  </div>
</template>

<style scoped>
.settings-page{width:min(100%,76rem);margin:0 auto}.settings-toolbar{display:flex;justify-content:flex-end;padding-bottom:.75rem}.settings-page .settings-workbench{width:100%;margin:0}
.settings-workbench{display:grid;grid-template-columns:15rem minmax(0,1fr);width:min(100%,76rem);min-height:calc(100vh - 8rem);margin:0 auto;border:1px solid var(--ui-border);background:var(--ui-bg)}.settings-rail{padding:1.5rem;border-right:1px solid var(--ui-border);background:var(--ui-bg-muted)}.settings-rail__label,.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.7rem;font-weight:800;color:var(--ui-text-muted);margin-bottom:1rem}.settings-step{display:flex;width:100%;gap:.75rem;align-items:center;padding:.7rem;border-radius:.5rem;text-align:left;color:var(--ui-text-muted)}.settings-step:hover:not(:disabled),.settings-step--active{background:var(--ui-bg-accented);color:var(--ui-text-highlighted)}.settings-step:focus-visible{outline:2px solid var(--portal-primary);outline-offset:2px}.settings-step:disabled{opacity:.45}.settings-step span{display:grid;place-items:center;width:1.65rem;height:1.65rem;border:1px solid var(--ui-border);border-radius:999px}.settings-panel{padding:clamp(1.25rem,4vw,3rem);min-width:0}.settings-panel h1{font-size:clamp(2rem,5vw,3.5rem);font-weight:800;overflow-wrap:anywhere;margin-bottom:2rem}.settings-form{width:100%;min-width:0}.settings-alert{margin-top:1.25rem}.settings-actions{display:grid;grid-template-columns:auto 1fr auto;gap:1rem;margin-top:2rem;padding-top:1.5rem;border-top:1px solid var(--ui-border)}.settings-state{display:flex;gap:.5rem;align-items:center;padding:2rem}@media(max-width:768px){.settings-workbench{grid-template-columns:1fr}.settings-rail{display:flex;overflow-x:auto;border-right:0;border-bottom:1px solid var(--ui-border)}.settings-rail__label{display:none}.settings-step{min-width:max-content}.settings-panel{padding:1rem}.settings-actions :deep(button){white-space:nowrap}}@media(max-width:414px){.settings-step{font-size:0}.settings-step span{font-size:.8rem}.settings-actions{grid-template-columns:1fr}.settings-actions span{display:none}.settings-actions :deep(button){width:100%}}
</style>
