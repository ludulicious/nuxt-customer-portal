<script setup lang="ts">
import { z } from 'zod'

const props = defineProps<{ organizationId?: string }>()
const { t } = useI18n()
const toast = useToast()
const busy = ref(false)
const removeOpen = ref(false)
const apiKey = ref('')
const organizationQuery = computed(() => props.organizationId ? { organizationId: props.organizationId } : {})
const { data: status, error: statusError, refresh } = await useFetch<{ configured: boolean, keyLastFour: string | null, updatedAt: string | null, verifiedDomains: string[] }>('/api/organizations/email-provider', { query: organizationQuery })
const schema = z.object({ apiKey: z.string().trim().min(8).max(500) })
const apiErrorCode = (error: unknown) => {
  if (!error || typeof error !== 'object') return null
  const response = error as { data?: { data?: { code?: string }, code?: string } }
  return response.data?.data?.code ?? response.data?.code ?? null
}
const save = async () => {
  busy.value = true
  try {
    await $fetch('/api/organizations/email-provider', { method: 'PUT', query: organizationQuery.value, body: { apiKey: apiKey.value } })
    apiKey.value = ''
    await refresh()
    toast.add({ title: t('organization.emailProvider.saved'), color: 'success' })
  } catch (error) {
    const permissionRequired = apiErrorCode(error) === 'RESEND_DOMAIN_PERMISSION_REQUIRED'
    toast.add({
      title: t(permissionRequired ? 'organization.emailProvider.permissionRequired' : 'organization.emailProvider.invalid'),
      description: permissionRequired ? t('organization.emailProvider.permissionRequiredDescription') : t('organization.emailProvider.invalidDescription'),
      color: 'error'
    })
  } finally {
    busy.value = false
  }
}
const recheck = async () => {
  busy.value = true
  try {
    status.value = await $fetch('/api/organizations/email-provider', { query: { ...organizationQuery.value, refresh: '1' } })
  } catch (error) {
    toast.add({ title: t('organization.emailProvider.checkFailed'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
const remove = async () => {
  busy.value = true
  try {
    await $fetch('/api/organizations/email-provider', { method: 'DELETE', query: organizationQuery.value })
    await refresh()
    toast.add({ title: t('organization.emailProvider.removed'), color: 'success' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div>
        <h2 class="text-xl font-semibold">{{ t('organization.emailProvider.title') }}</h2>
        <p class="text-sm text-muted">{{ t('organization.emailProvider.description') }}</p>
      </div>
    </template>
    <div class="space-y-4">
      <UAlert v-if="statusError" color="error" icon="i-lucide-server-crash"
        :title="t('organization.emailProvider.statusFailed')"
        :description="t('organization.emailProvider.statusFailedDescription')" variant="outline" />
      <UAlert v-else :color="status?.configured ? 'success' : 'warning'"
        :icon="status?.configured ? 'i-lucide-key-round' : 'i-lucide-triangle-alert'"
        :title="t(status?.configured ? 'organization.emailProvider.configured' : 'organization.emailProvider.notConfigured')"
        :description="status?.configured ? t('organization.emailProvider.masked', { suffix: status.keyLastFour }) : t('organization.emailProvider.required')" variant="outline" />
      <div v-if="status?.verifiedDomains.length">
        <p class="text-sm font-medium">{{ t('organization.emailProvider.verifiedDomains') }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <UBadge v-for="domain in status.verifiedDomains" :key="domain" color="success" variant="subtle">
{{ domain }}
          </UBadge>
        </div>
      </div>
      <UButton to="https://resend.com/docs/dashboard/domains/introduction" target="_blank" rel="noopener noreferrer"
        color="neutral" variant="link" class="px-0" trailing-icon="i-lucide-external-link">
{{
          t('organization.emailProvider.documentation') }}
</UButton>
      <UForm :state="{ apiKey }" :schema="schema" class="space-y-3" @submit="save">
        <UFormField name="apiKey"
          :label="t(status?.configured ? 'organization.emailProvider.replaceLabel' : 'organization.emailProvider.keyLabel')">
          <UInput v-model="apiKey" type="password" autocomplete="new-password" placeholder="re_…" class="w-full" />
        </UFormField>
        <div class="flex flex-wrap gap-2">
          <UButton type="submit" icon="i-lucide-save" :loading="busy">
{{ t(status?.configured
            ? 'organization.emailProvider.replace' : 'organization.emailProvider.configure') }}
</UButton>
          <UButton v-if="status?.configured" type="button" color="neutral" variant="outline" icon="i-lucide-refresh-cw"
            :loading="busy" @click="recheck">
{{ t('organization.emailProvider.checkAgain') }}
</UButton>
          <UButton v-if="status?.configured" type="button" color="error" variant="ghost" icon="i-lucide-trash-2"
            @click="removeOpen = true">
{{ t('organization.emailProvider.remove') }}
</UButton>
        </div>
      </UForm>
    </div>
    <ConfirmationModal v-model:open="removeOpen" :title="t('organization.emailProvider.removeTitle')"
      :message="t('organization.emailProvider.removeDescription')"
      :confirm-text="t('organization.emailProvider.remove')" :cancel-text="t('common.cancel')" confirm-color="error"
      @confirm="remove" />
  </UCard>
</template>
