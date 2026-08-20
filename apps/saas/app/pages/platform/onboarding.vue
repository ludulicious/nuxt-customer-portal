<script setup lang="ts">
definePageMeta({ public: true })

const form = reactive({
  companyName: '',
  slug: '',
  modules: ['timesheets'],
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  databaseMode: 'managed' as 'managed' | 'byod',
  databaseUrl: ''
})
const modules = ['timesheets', 'invoices', 'service-requests']
const submitting = ref(false)
const result = ref<{ canonicalDomain: string } | null>(null)
const errorMessage = ref('')

const submit = async () => {
  submitting.value = true
  errorMessage.value = ''
  try {
    result.value = await $fetch('/api/platform/onboarding', {
      method: 'POST',
      body: {
        companyName: form.companyName,
        slug: form.slug,
        modules: form.modules,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
        database: form.databaseMode === 'byod'
          ? { mode: 'byod', url: form.databaseUrl }
          : { mode: 'managed' }
      }
    })
    form.adminPassword = ''
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Onboarding failed'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <main class="mx-auto max-w-2xl px-6 py-16">
    <p class="text-sm font-semibold uppercase tracking-widest text-primary">Platform onboarding</p>
    <h1 class="mt-3 text-3xl font-bold">Create your workspace</h1>
    <p class="mt-3 text-muted">This platform workflow provisions a separate database and the first tenant administrator.</p>

    <UAlert v-if="result" class="mt-8" color="success" title="Workspace created" :description="`Continue at https://${result.canonicalDomain}`" />
    <UAlert v-if="errorMessage" class="mt-8" color="error" title="Onboarding failed" :description="errorMessage" />

    <UForm :state="form" class="mt-8 space-y-5" @submit="submit">
      <UFormField label="Company name" name="companyName"><UInput v-model="form.companyName" /></UFormField>
      <UFormField label="Workspace slug" name="slug"><UInput v-model="form.slug" placeholder="acme" /></UFormField>
      <UFormField label="First tenant admin name" name="adminName"><UInput v-model="form.adminName" /></UFormField>
      <UFormField label="First tenant admin email" name="adminEmail"><UInput v-model="form.adminEmail" type="email" /></UFormField>
      <UFormField label="First tenant admin password" name="adminPassword"><UInput v-model="form.adminPassword" type="password" /></UFormField>
      <UFormField label="Modules" name="modules">
        <div class="space-y-2">
          <UCheckbox v-for="module in modules" :key="module" v-model="form.modules" :value="module" :label="module" />
        </div>
      </UFormField>
      <UFormField label="Database" name="databaseMode">
        <URadioGroup v-model="form.databaseMode" :items="[{ label: 'Managed database', value: 'managed' }, { label: 'Bring your own PostgreSQL database', value: 'byod' }]" />
      </UFormField>
      <UFormField v-if="form.databaseMode === 'byod'" label="PostgreSQL URL" name="databaseUrl">
        <UInput v-model="form.databaseUrl" type="password" placeholder="postgresql://…" />
      </UFormField>
      <UButton type="submit" :loading="submitting">Create workspace</UButton>
    </UForm>
  </main>
</template>
