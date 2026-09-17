<script setup lang="ts">
import { z } from 'zod'
import type { PortalEmailLocale } from '@nuxt-customer-portal/core/shared/types/feature'
import type { PortalEmailSettings } from '../../../types/admin-email'

const props = defineProps<{ settings: PortalEmailSettings }>()
const { t } = useI18n()
const toast = useToast()
const busy = ref(false)
const state = reactive({
  apiKey: '',
  fromName: props.settings.fromName,
  fromEmail: props.settings.fromEmail,
  defaultLocale: props.settings.defaultLocale
})
const credential = reactive({ configured: props.settings.configured, keyLastFour: props.settings.keyLastFour })
const providerStatus = ref<{ verifiedDomains: string[] } | null>(null)
const providerError = ref('')
const senderDomain = computed(() => state.fromEmail.trim().split('@')[1]?.toLowerCase() || '')
const senderVerified = computed(
  () => Boolean(senderDomain.value) && Boolean(providerStatus.value?.verifiedDomains.includes(senderDomain.value))
)
const localeOptions = [
  { label: 'English', value: 'en' as PortalEmailLocale },
  { label: 'Nederlands', value: 'nl' as PortalEmailLocale }
]
const schema = z.object({
  apiKey: z.string().refine((value) => !value || value.trim().length >= 8, t('admin.email.validation.apiKey')),
  fromName: z.string().trim().max(200),
  fromEmail: z.string().trim().email(t('admin.email.validation.fromEmail')).max(320),
  defaultLocale: z.enum(['en', 'nl'])
})
const save = async () => {
  busy.value = true
  try {
    const result = await $fetch<PortalEmailSettings>('/api/admin/email/provider', {
      method: 'PUT',
      body: { ...state, apiKey: state.apiKey || undefined }
    })
    state.apiKey = ''
    credential.configured = result.configured
    credential.keyLastFour = result.keyLastFour
    if (result.configured) {
      await checkProvider(false)
    }
    toast.add({ title: t('admin.email.saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('admin.email.saveFailed'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
const checkProvider = async (notify = true) => {
  busy.value = true
  providerError.value = ''
  try {
    const result = await $fetch<{ verifiedDomains: string[] }>('/api/admin/email/provider')
    providerStatus.value = result
    if (notify) {
      toast.add({
        title: t(senderVerified.value ? 'admin.email.senderDomainVerified' : 'admin.email.senderDomainUnverified'),
        color: senderVerified.value ? 'success' : 'warning'
      })
    }
  } catch (error) {
    providerStatus.value = null
    providerError.value = String(error)
    if (notify) {
      toast.add({ title: t('admin.email.providerInvalid'), description: providerError.value, color: 'error' })
    }
  } finally {
    busy.value = false
  }
}
if (credential.configured) {
  await checkProvider(false)
}
</script>

<template>
  <UForm :schema="schema" :state="state" novalidate class="space-y-6" @submit="save">
    <UCard>
      <template #header
        ><h2 class="font-semibold">{{ t('admin.email.provider') }}</h2></template
      >
      <UAlert
        v-if="providerStatus"
        class="mb-4"
        :color="senderVerified ? 'success' : 'warning'"
        :icon="senderVerified ? 'i-lucide-badge-check' : 'i-lucide-triangle-alert'"
        :title="t(senderVerified ? 'admin.email.senderDomainVerified' : 'admin.email.senderDomainUnverified')"
        variant="outline"
      >
        <template #description>
          <p>
            {{
              t(
                senderVerified
                  ? 'admin.email.senderDomainVerifiedDescription'
                  : 'admin.email.senderDomainUnverifiedDescription',
                { domain: senderDomain || state.fromEmail }
              )
            }}
          </p>
          <p v-if="providerStatus.verifiedDomains.length" class="mt-1 text-xs">
            {{ t('admin.email.verifiedDomains', { domains: providerStatus.verifiedDomains.join(', ') }) }}
          </p>
          <UButton
            type="button"
            class="mt-2"
            color="neutral"
            variant="solid"
            size="xs"
            icon="i-lucide-refresh-cw"
            :loading="busy"
            @click="checkProvider()"
          >
            {{ t('admin.email.checkAgain') }}
          </UButton>
        </template>
      </UAlert>
      <UAlert
        v-else-if="providerError"
        class="mb-4"
        color="error"
        icon="i-lucide-circle-alert"
        :title="t('admin.email.providerInvalid')"
        :description="providerError"
        variant="outline"
      >
        <template #actions>
          <UButton
            type="button"
            color="neutral"
            variant="solid"
            size="xs"
            icon="i-lucide-refresh-cw"
            :loading="busy"
            @click="checkProvider()"
          >
            {{ t('admin.email.checkAgain') }}
          </UButton>
        </template>
      </UAlert>
      <div class="grid gap-4 md:grid-cols-2">
        <UFormField
          name="apiKey"
          :label="
            credential.configured
              ? t('admin.email.replaceKey', { suffix: credential.keyLastFour })
              : t('admin.email.apiKey')
          "
        >
          <UInput v-model="state.apiKey" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UFormField name="fromName" :label="t('admin.email.fromName')"
          ><UInput v-model="state.fromName" class="w-full"
        /></UFormField>
        <UFormField name="fromEmail" :label="t('admin.email.fromEmail')"
          ><UInput v-model="state.fromEmail" type="email" class="w-full"
        /></UFormField>
        <UFormField name="defaultLocale" :label="t('admin.email.defaultLocale')"
          ><USelect v-model="state.defaultLocale" :items="localeOptions" class="w-full"
        /></UFormField>
      </div>
      <UButton
        v-if="!credential.configured"
        type="button"
        class="mt-4"
        color="neutral"
        variant="outline"
        icon="i-lucide-badge-check"
        :loading="busy"
        @click="checkProvider()"
        >{{ t('admin.email.validateProvider') }}</UButton
      >
    </UCard>
    <div class="flex justify-end">
      <UButton type="submit" icon="i-lucide-save" class="ml-auto flex min-w-28 justify-center" :loading="busy">{{
        t('admin.email.saveProvider')
      }}</UButton>
    </div>
  </UForm>
</template>
