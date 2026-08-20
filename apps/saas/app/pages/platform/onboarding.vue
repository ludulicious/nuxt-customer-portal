<script setup lang="ts">
import { z } from 'zod'

definePageMeta({ public: true })

const { t } = useI18n()
const form = reactive({ companyName: '', slug: '', modules: ['timesheets'], adminName: '', adminEmail: '', adminPassword: '', databaseMode: 'managed' as 'managed' | 'byod', databaseUrl: '' })
const modules = ['timesheets', 'invoices']
const submitting = ref(false)
const result = ref<{ canonicalDomain: string } | null>(null)
const errorMessage = ref('')
const schema = computed(() => z.object({
  companyName: z.string().trim().min(2, t('platform.onboarding.validation.companyName')).max(200),
  slug: z.string().trim().min(1, t('platform.onboarding.validation.slug')).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t('platform.onboarding.validation.slug')),
  adminName: z.string().trim().min(2, t('platform.onboarding.validation.adminName')).max(200),
  adminEmail: z.string().trim().email(t('platform.onboarding.validation.adminEmail')).max(320),
  adminPassword: z.string().min(8, t('platform.onboarding.validation.adminPassword')),
  modules: z.array(z.string()).min(1, t('platform.onboarding.validation.modules')),
  databaseMode: z.enum(['managed', 'byod']),
  databaseUrl: z.string().refine(value => form.databaseMode !== 'byod' || /^postgres(ql)?:\/\//.test(value), t('platform.onboarding.validation.databaseUrl'))
}))

const submit = async () => {
  submitting.value = true
  errorMessage.value = ''
  try {
    result.value = await $fetch('/api/platform/onboarding', { method: 'POST', body: { companyName: form.companyName.trim(), slug: form.slug.trim(), modules: form.modules, adminName: form.adminName.trim(), adminEmail: form.adminEmail.trim().toLowerCase(), adminPassword: form.adminPassword, database: form.databaseMode === 'byod' ? { mode: 'byod', url: form.databaseUrl } : { mode: 'managed' } } })
    form.adminPassword = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : t('platform.onboarding.error')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto h-full min-h-0 max-w-3xl overflow-y-auto px-6 py-10 lg:px-8">
    <p class="text-sm font-semibold uppercase tracking-widest text-primary">{{ t('platform.onboarding.eyebrow') }}</p>
    <h1 class="mt-2 text-3xl font-bold">{{ t('platform.onboarding.title') }}</h1>
    <p class="mt-2 text-muted">{{ t('platform.onboarding.description') }}</p>

    <UAlert v-if="result" class="mt-6" color="success" :title="t('platform.onboarding.success')" :description="t('platform.onboarding.successDescription', { domain: result.canonicalDomain })" />
    <UAlert v-if="errorMessage" class="mt-6" color="error" :title="t('platform.onboarding.error')" :description="errorMessage" />

    <UCard class="mt-8 scroll-mt-24">
      <template #header><div class="flex items-center justify-between gap-3"><h2 class="font-semibold">{{ t('platform.onboarding.formTitle') }}</h2><UButton to="/platform/workspaces" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('platform.onboarding.cancel')" /></div></template>
      <UForm :state="form" :schema="schema" class="space-y-5" @submit="submit">
        <div class="grid gap-4 md:grid-cols-2">
          <UFormField name="companyName" :label="t('platform.onboarding.companyName')" required><UInput v-model="form.companyName" class="w-full" /></UFormField>
          <UFormField name="slug" :label="t('platform.onboarding.slug')" required><UInput v-model="form.slug" placeholder="acme" class="w-full" /></UFormField>
          <UFormField name="adminName" :label="t('platform.onboarding.adminName')" required><UInput v-model="form.adminName" class="w-full" /></UFormField>
          <UFormField name="adminEmail" :label="t('platform.onboarding.adminEmail')" required><UInput v-model="form.adminEmail" type="email" class="w-full" /></UFormField>
          <UFormField name="adminPassword" :label="t('platform.onboarding.adminPassword')" required><UInput v-model="form.adminPassword" type="password" class="w-full" /></UFormField>
          <UFormField name="databaseMode" :label="t('platform.onboarding.database')" required><URadioGroup v-model="form.databaseMode" :items="[{ label: t('platform.onboarding.managedDatabase'), value: 'managed' }, { label: t('platform.onboarding.byodDatabase'), value: 'byod' }]" /></UFormField>
        </div>
        <UFormField v-if="form.databaseMode === 'byod'" name="databaseUrl" :label="t('platform.onboarding.databaseUrl')" required><UInput v-model="form.databaseUrl" type="password" placeholder="postgresql://…" class="w-full" /></UFormField>
        <UFormField name="modules" :label="t('platform.onboarding.modules')" required><div class="grid gap-2 sm:grid-cols-3"><UCheckbox v-for="module in modules" :key="module" v-model="form.modules" :value="module" :label="t(`platform.onboarding.module.${module}`)" /></div></UFormField>
        <div class="flex justify-end gap-2"><UButton to="/platform/workspaces" color="neutral" variant="outline">{{ t('platform.onboarding.cancel') }}</UButton><UButton type="submit" :loading="submitting" icon="i-lucide-plus">{{ t('platform.onboarding.create') }}</UButton></div>
      </UForm>
    </UCard>
  </main>
</template>
