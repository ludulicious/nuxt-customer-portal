<!-- Hallmark · macrostructure: Workbench · tone: calm operational · anchor hue: existing-primary -->
<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ public: true })

const { t } = useI18n()
const form = reactive({ companyName: '', slug: '', modules: ['timesheets'], adminName: '', adminEmail: '', adminPassword: '', databaseMode: 'managed' as 'managed' | 'byod', databaseUrl: '' })
const modules = ['timesheets', 'invoices', 'service-requests']
const moduleCards = computed(() => modules.map(module => ({ value: module, label: t(`platform.onboarding.module.${module}`), description: t(`platform.onboarding.moduleDescription.${module}`), icon: module === 'timesheets' ? 'i-lucide-clock-3' : module === 'invoices' ? 'i-lucide-receipt' : 'i-lucide-life-buoy' })))
const currentStep = ref(0)
const submitting = ref(false)
const result = ref<{ canonicalDomain: string } | null>(null)
const errorMessage = ref('')
const fieldErrors = ref<Record<string, string>>({})
const steps = computed(() => [
  { label: t('platform.onboarding.steps.identity'), title: t('platform.onboarding.stepTitles.identity'), description: t('platform.onboarding.stepDescriptions.identity') },
  { label: t('platform.onboarding.steps.admin'), title: t('platform.onboarding.stepTitles.admin'), description: t('platform.onboarding.stepDescriptions.admin') },
  { label: t('platform.onboarding.steps.modules'), title: t('platform.onboarding.stepTitles.modules'), description: t('platform.onboarding.stepDescriptions.modules') },
  { label: t('platform.onboarding.steps.database'), title: t('platform.onboarding.stepTitles.database'), description: t('platform.onboarding.stepDescriptions.database') },
  { label: t('platform.onboarding.steps.review'), title: t('platform.onboarding.stepTitles.review'), description: t('platform.onboarding.stepDescriptions.review') }
])
const allSchema = computed(() => z.object({
  companyName: z.string().trim().min(2, t('platform.onboarding.validation.companyName')).max(200),
  slug: z.string().trim().min(1, t('platform.onboarding.validation.slug')).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t('platform.onboarding.validation.slug')),
  adminName: z.string().trim().min(2, t('platform.onboarding.validation.adminName')).max(200),
  adminEmail: z.string().trim().email(t('platform.onboarding.validation.adminEmail')).max(320),
  adminPassword: z.string().min(8, t('platform.onboarding.validation.adminPassword')),
  modules: z.array(z.string()).min(1, t('platform.onboarding.validation.modules')),
  databaseMode: z.enum(['managed', 'byod']),
  databaseUrl: z.string().refine(value => form.databaseMode !== 'byod' || /^postgres(ql)?:\/\//.test(value), t('platform.onboarding.validation.databaseUrl'))
}))
const stepFields = [['companyName', 'slug'], ['adminName', 'adminEmail', 'adminPassword'], ['modules'], ['databaseMode', 'databaseUrl']]
const isLastStep = computed(() => currentStep.value === steps.value.length - 1)
const currentStepData = computed(() => steps.value[currentStep.value] ?? { label: '', title: '', description: '' })

const validateStep = (step = currentStep.value) => {
  fieldErrors.value = {}
  if (step === 4) return true
  const parsed = allSchema.value.safeParse(form)
  if (parsed.success) return true
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] || '')
    if (stepFields[step]?.includes(field) && !fieldErrors.value[field]) fieldErrors.value[field] = issue.message
  }
  return Object.keys(fieldErrors.value).length === 0
}
const nextStep = () => {
  errorMessage.value = ''
  if (!validateStep()) return
  currentStep.value = Math.min(currentStep.value + 1, steps.value.length - 1)
}
const previousStep = () => { errorMessage.value = ''; fieldErrors.value = {}; currentStep.value = Math.max(currentStep.value - 1, 0) }
const goToStep = (step: number) => { if (step < currentStep.value) { currentStep.value = step; fieldErrors.value = {} } }
const toggleModule = (module: string) => {
  form.modules = form.modules.includes(module) ? form.modules.filter(value => value !== module) : [...form.modules, module]
}
const submit = async () => {
  const firstInvalid = [0, 1, 2, 3].find(step => !validateStep(step))
  if (firstInvalid !== undefined) { currentStep.value = firstInvalid; return }
  submitting.value = true
  errorMessage.value = ''
  try {
    result.value = await $fetch('/api/platform/onboarding', { method: 'POST', body: { companyName: form.companyName.trim(), slug: form.slug.trim(), modules: form.modules, adminName: form.adminName.trim(), adminEmail: form.adminEmail.trim().toLowerCase(), adminPassword: form.adminPassword, database: form.databaseMode === 'byod' ? { mode: 'byod', url: form.databaseUrl } : { mode: 'managed' } } })
    await refreshNuxtData('platform-workspace-state')
    form.adminPassword = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('platform.onboarding.error')
  } finally { submitting.value = false }
}
</script>

<template>
  <main class="mx-auto h-full min-h-0 max-w-6xl overflow-y-auto px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
    <div v-if="result" class="mx-auto max-w-2xl py-10 lg:py-16">
      <div class="flex size-14 items-center justify-center rounded-full bg-success/15 text-success"><UIcon name="i-lucide-check" class="size-7" /></div>
      <p class="mt-6 text-sm font-semibold uppercase tracking-widest text-primary">{{ t('platform.onboarding.successEyebrow') }}</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{{ t('platform.onboarding.success') }}</h1>
      <p class="mt-3 text-muted">{{ t('platform.onboarding.successDescription', { domain: result.canonicalDomain }) }}</p>
      <div class="mt-8 flex flex-wrap gap-3"><UButton :href="`https://${result.canonicalDomain}`" target="_blank" icon="i-lucide-external-link">{{ t('platform.onboarding.openWorkspace') }}</UButton><UButton to="/platform/workspaces" color="neutral" variant="outline">{{ t('platform.onboarding.viewWorkspaces') }}</UButton></div>
    </div>
    <template v-else>
      <header class="max-w-3xl"><p class="text-sm font-semibold uppercase tracking-widest text-primary">{{ t('platform.onboarding.eyebrow') }}</p><h1 class="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{{ t('platform.onboarding.title') }}</h1><p class="mt-3 text-muted">{{ t('platform.onboarding.description') }}</p></header>
      <div class="mt-8 grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <nav class="rounded-xl border border-default bg-elevated/30 p-3 lg:sticky lg:top-6" :aria-label="t('platform.onboarding.progressLabel')">
          <p class="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">{{ t('platform.onboarding.progress', { current: currentStep + 1, total: steps.length }) }}</p>
          <ol class="grid grid-cols-5 gap-2 lg:grid-cols-1 lg:gap-1">
            <li v-for="(step, index) in steps" :key="step.label"><button type="button" class="flex w-full items-center gap-3 rounded-lg p-2 text-left text-sm transition-colors disabled:cursor-default lg:py-3" :class="index === currentStep ? 'bg-primary/10 text-primary' : index < currentStep ? 'text-default' : 'text-muted'" :disabled="index >= currentStep" @click="goToStep(index)"><span class="flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold" :class="index < currentStep ? 'border-success bg-success text-white' : index === currentStep ? 'border-primary bg-primary text-white' : 'border-default'"><UIcon v-if="index < currentStep" name="i-lucide-check" class="size-4" /><span v-else>{{ index + 1 }}</span></span><span class="hidden min-w-0 truncate lg:block">{{ step.label }}</span></button></li>
          </ol>
        </nav>
        <section class="min-w-0">
          <UAlert v-if="errorMessage" class="mb-4" color="error" :title="t('platform.onboarding.error')" :description="errorMessage" />
          <form class="rounded-xl border border-default bg-elevated/20 p-5 shadow-sm sm:p-8" @submit.prevent="isLastStep ? submit() : nextStep()">
            <div class="flex items-start justify-between gap-4 border-b border-default pb-6"><div><p class="text-sm font-semibold text-primary">{{ currentStepData.label }}</p><h2 class="mt-1 text-2xl font-bold">{{ currentStepData.title }}</h2><p class="mt-2 text-sm text-muted">{{ currentStepData.description }}</p></div><UButton to="/platform/workspaces" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('platform.onboarding.cancel')" /></div>
            <div class="mt-7 space-y-6">
              <div v-if="currentStep === 0" class="grid gap-5 md:grid-cols-2"><UFormField name="companyName" :label="t('platform.onboarding.companyName')" required :error="fieldErrors.companyName"><UInput v-model="form.companyName" class="w-full" autofocus /></UFormField><UFormField name="slug" :label="t('platform.onboarding.slug')" required :error="fieldErrors.slug"><UInput v-model="form.slug" placeholder="acme" class="w-full" /></UFormField></div>
              <div v-else-if="currentStep === 1" class="grid gap-5 md:grid-cols-2"><UFormField name="adminName" :label="t('platform.onboarding.adminName')" required :error="fieldErrors.adminName"><UInput v-model="form.adminName" class="w-full" autofocus /></UFormField><UFormField name="adminEmail" :label="t('platform.onboarding.adminEmail')" required :error="fieldErrors.adminEmail"><UInput v-model="form.adminEmail" type="email" class="w-full" /></UFormField><UFormField name="adminPassword" :label="t('platform.onboarding.adminPassword')" required :error="fieldErrors.adminPassword"><UInput v-model="form.adminPassword" type="password" class="w-full" /></UFormField></div>
              <div v-else-if="currentStep === 2"><UFormField name="modules" :label="t('platform.onboarding.modules')" required :error="fieldErrors.modules"><div class="grid gap-3 sm:grid-cols-2"><button v-for="module in moduleCards" :key="module.value" type="button" class="group flex min-h-32 items-start gap-4 rounded-xl border p-4 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" :class="form.modules.includes(module.value) ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-default bg-background/30 hover:border-primary/50 hover:bg-elevated/40'" :aria-pressed="form.modules.includes(module.value)" @click="toggleModule(module.value)"><span class="flex size-11 shrink-0 items-center justify-center rounded-lg" :class="form.modules.includes(module.value) ? 'bg-primary text-white' : 'bg-elevated text-primary'"><UIcon :name="module.icon" class="size-6" /></span><span class="min-w-0 flex-1"><span class="flex items-center justify-between gap-2"><span class="font-semibold">{{ module.label }}</span><UIcon :name="form.modules.includes(module.value) ? 'i-lucide-circle-check' : 'i-lucide-circle'" class="size-5 shrink-0" :class="form.modules.includes(module.value) ? 'text-primary' : 'text-muted'" /></span><span class="mt-1 block text-sm leading-5 text-muted">{{ module.description }}</span></span></button></div></UFormField></div>
              <div v-else-if="currentStep === 3" class="space-y-5"><UFormField name="databaseMode" :label="t('platform.onboarding.database')" required><URadioGroup v-model="form.databaseMode" :items="[{ label: t('platform.onboarding.managedDatabase'), value: 'managed' }, { label: t('platform.onboarding.byodDatabase'), value: 'byod' }]" /></UFormField><UFormField v-if="form.databaseMode === 'byod'" name="databaseUrl" :label="t('platform.onboarding.databaseUrl')" required :error="fieldErrors.databaseUrl"><UInput v-model="form.databaseUrl" type="password" placeholder="postgresql://…" class="w-full" /></UFormField></div>
              <div v-else class="space-y-3"><p class="text-sm text-muted">{{ t('platform.onboarding.reviewHint') }}</p><div v-for="item in [{ label: t('platform.onboarding.companyName'), value: form.companyName, step: 0 }, { label: t('platform.onboarding.adminEmail'), value: form.adminEmail, step: 1 }, { label: t('platform.onboarding.modules'), value: form.modules.map(module => t(`platform.onboarding.module.${module}`)).join(', '), step: 2 }, { label: t('platform.onboarding.database'), value: form.databaseMode === 'managed' ? t('platform.onboarding.managedDatabase') : t('platform.onboarding.byodDatabase'), step: 3 }]" :key="item.label" class="flex items-center justify-between gap-4 rounded-lg border border-default p-4"><div class="min-w-0"><p class="text-xs font-semibold uppercase tracking-wide text-muted">{{ item.label }}</p><p class="mt-1 truncate font-medium">{{ item.value || '—' }}</p></div><UButton type="button" color="neutral" variant="ghost" size="sm" @click="goToStep(item.step)">{{ t('platform.onboarding.edit') }}</UButton></div></div>
            </div>
            <div class="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-default pt-6"><UButton v-if="currentStep > 0" type="button" color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="previousStep">{{ t('platform.onboarding.back') }}</UButton><UButton v-else type="button" to="/platform/workspaces" color="neutral" variant="outline">{{ t('platform.onboarding.cancel') }}</UButton><UButton type="submit" :loading="submitting" trailing-icon="i-lucide-arrow-right">{{ isLastStep ? t('platform.onboarding.create') : t('platform.onboarding.continue') }}</UButton></div>
          </form>
        </section>
      </div>
    </template>
  </main>
</template>
