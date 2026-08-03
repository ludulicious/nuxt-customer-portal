<script setup lang="ts">
import { z } from 'zod'
import type { OrganizationInvoiceProfileDto } from '#layers/timesheets/shared/types/timesheet'

const props = defineProps<{
  profile: OrganizationInvoiceProfileDto
  refresh: () => Promise<unknown>
}>()

const { t } = useI18n()
const toast = useToast()
const timesheets = useTimesheets()
const { activeOrganizationRole, isSystemAdmin } = usePortalSession()
const canConfigureProvider = computed(() => isSystemAdmin.value || activeOrganizationRole.value === 'owner')
const busy = ref(false)
const checkingDomain = ref(false)
type DomainStatus = { email: string | null, domain: string | null, configured: boolean, verified: boolean }
const { data: domainStatus, refresh: refreshDomainStatus } = await useFetch<DomainStatus>('/api/timesheets/admin/email-domain')
const draft = reactive({
  address: '',
  registrationNumber: '',
  vatNumber: '',
  iban: '',
  bic: '',
  invoiceEmail: ''
})
const schema = computed(() => z.object({
  address: z.string().trim().min(1, t('features.timesheets.validation.required')).max(1000),
  registrationNumber: z.string().trim().min(1, t('features.timesheets.validation.required')).max(200),
  vatNumber: z.string().trim().min(1, t('features.timesheets.validation.required')).max(100),
  iban: z.string().trim().min(1, t('features.timesheets.validation.required')).max(100),
  bic: z.string().trim().min(1, t('features.timesheets.validation.required')).max(100),
  invoiceEmail: z.string().trim().min(1, t('features.timesheets.validation.required')).email(t('features.timesheets.validation.validEmail')).max(320)
}))

const checkDomain = async (forceRefresh = true) => {
  checkingDomain.value = true
  try {
    const status = await $fetch<DomainStatus>('/api/timesheets/admin/email-domain', { query: forceRefresh ? { refresh: '1' } : undefined })
    domainStatus.value = status
    toast.add({ title: t(status.verified ? 'features.timesheets.admin.emailDomainNowVerified' : 'features.timesheets.admin.emailDomainStillUnverified'), color: status.verified ? 'success' : 'warning' })
  } catch (error) {
    toast.add({ title: t('features.timesheets.admin.emailDomainCheckFailed'), description: String(error), color: 'error' })
  } finally {
    checkingDomain.value = false
  }
}

watch(() => props.profile, (profile) => {
  Object.assign(draft, {
    address: profile.address,
    registrationNumber: profile.registrationNumber ?? '',
    vatNumber: profile.vatNumber ?? '',
    iban: profile.iban ?? '',
    bic: profile.bic ?? '',
    invoiceEmail: profile.invoiceEmail ?? ''
  })
}, { immediate: true })

const save = async () => {
  busy.value = true
  try {
    const input = Object.fromEntries(
      Object.entries(draft).map(([key, value]) => [key, value || (key === 'address' ? '' : null)])
    )
    await timesheets.updateOrganizationProfile(props.profile.organizationId, input)
    await props.refresh()
    await refreshDomainStatus()
    toast.add({ title: t('features.timesheets.messages.senderInvoiceDetailsSaved'), color: 'success' })
  } catch (error) {
    toast.add({
      title: t('features.timesheets.messages.saveError'),
      description: String(error),
      color: 'error'
    })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard id="sender-invoice-details" class="scroll-mt-6">
    <template #header>
      <h2 class="font-semibold">
        {{ t('features.timesheets.admin.senderInvoiceDetails') }}
      </h2>
    </template>
    <UForm :state="draft" :schema="schema" class="space-y-4" @submit="save">
      <UAlert v-if="!domainStatus?.configured" color="warning" icon="i-lucide-key-round" :title="t('features.timesheets.admin.emailProviderNotConfigured')" variant="outline" >
        <template #description>
          <p>{{ t(canConfigureProvider ? 'features.timesheets.admin.emailProviderConfigureDescription' : 'features.timesheets.admin.emailProviderContactOwner') }}</p>
          <UButton v-if="canConfigureProvider" to="/settings/organization" color="neutral" variant="solid" size="xs" icon="i-lucide-settings" class="mt-2">{{ t('features.timesheets.admin.emailProviderOpenSettings') }}</UButton>
        </template>
      </UAlert>
      <UAlert v-else
        :color="domainStatus?.verified ? 'success' : 'warning'"
        :icon="domainStatus?.verified ? 'i-lucide-badge-check' : 'i-lucide-triangle-alert'"
        :title="t(domainStatus?.verified ? 'features.timesheets.admin.emailDomainVerified' : 'features.timesheets.admin.emailDomainUnverified')" variant="outline" >
        <template #description><p>{{ domainStatus?.domain ? t('features.timesheets.admin.emailDomainStatusDescription', { domain: domainStatus.domain }) : t('features.timesheets.admin.emailDomainMissing') }}</p><div v-if="domainStatus?.domain" class="mt-2 flex flex-wrap gap-2"><UButton v-if="!domainStatus.verified" to="https://resend.com/docs/dashboard/domains/introduction" target="_blank" rel="noopener noreferrer" color="neutral" variant="solid" size="xs" trailing-icon="i-lucide-external-link">{{ t('features.timesheets.admin.emailDomainVerificationHelp') }}</UButton><UButton type="button" color="neutral" variant="solid" size="xs" icon="i-lucide-refresh-cw" :loading="checkingDomain" @click="checkDomain()">{{ t('features.timesheets.admin.emailDomainCheckAgain') }}</UButton></div></template>
      </UAlert>
      <UFormField name="address" :label="t('features.timesheets.admin.address')" required>
        <UTextarea v-model="draft.address" class="w-full" />
      </UFormField>
      <div class="grid gap-3 md:grid-cols-2">
        <UFormField name="registrationNumber" :label="t('features.timesheets.admin.registration')" required>
          <UInput v-model="draft.registrationNumber" class="w-full" />
        </UFormField>
        <UFormField name="vatNumber" :label="t('features.timesheets.admin.vatNumber')" required>
          <UInput v-model="draft.vatNumber" class="w-full" />
        </UFormField>
        <UFormField name="iban" label="IBAN" required>
          <UInput v-model="draft.iban" class="w-full" />
        </UFormField>
        <UFormField name="bic" label="BIC" required>
          <UInput v-model="draft.bic" class="w-full" />
        </UFormField>
        <UFormField name="invoiceEmail" :label="t('features.timesheets.admin.invoiceEmail')" required>
          <UInput v-model="draft.invoiceEmail" type="email" class="w-full" />
        </UFormField>
      </div>
      <UButton type="submit" block icon="i-lucide-save" :loading="busy">
        {{ t('features.timesheets.save') }}
      </UButton>
    </UForm>
  </UCard>
</template>
