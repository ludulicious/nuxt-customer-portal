<script setup lang="ts">
import { z } from 'zod'
import type { PortalEmailLocale } from '@nuxt-customer-portal/core/shared/types/feature'
import type { PortalEmailSettings } from '../../../types/admin-email'

const props = defineProps<{ settings: PortalEmailSettings }>()
const { t } = useI18n()
const toast = useToast()
const busy = ref(false)
const state = reactive({ apiKey: '', fromName: props.settings.fromName, fromEmail: props.settings.fromEmail, defaultLocale: props.settings.defaultLocale })
const credential = reactive({ configured: props.settings.configured, keyLastFour: props.settings.keyLastFour })
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
    const result = await $fetch<PortalEmailSettings>('/api/admin/email/provider', { method: 'PUT', body: { ...state, apiKey: state.apiKey || undefined } })
    state.apiKey = ''
    credential.configured = result.configured
    credential.keyLastFour = result.keyLastFour
    toast.add({ title: t('admin.email.saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('admin.email.saveFailed'), description: String(error), color: 'error' })
  } finally { busy.value = false }
}
const checkProvider = async () => {
  busy.value = true
  try {
    const result = await $fetch<{ verifiedDomains: string[] }>('/api/admin/email/provider')
    toast.add({ title: t('admin.email.providerValid'), description: result.verifiedDomains.join(', '), color: 'success' })
  } catch (error) {
    toast.add({ title: t('admin.email.providerInvalid'), description: String(error), color: 'error' })
  } finally { busy.value = false }
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-6" @submit="save">
    <UCard>
      <template #header><h2 class="font-semibold">{{ t('admin.email.provider') }}</h2></template>
      <div class="grid gap-4 md:grid-cols-2">
        <UFormField name="apiKey" :label="credential.configured ? t('admin.email.replaceKey', { suffix: credential.keyLastFour }) : t('admin.email.apiKey')">
          <UInput v-model="state.apiKey" type="password" autocomplete="new-password" class="w-full" />
        </UFormField>
        <UFormField name="fromName" :label="t('admin.email.fromName')"><UInput v-model="state.fromName" class="w-full" /></UFormField>
        <UFormField name="fromEmail" :label="t('admin.email.fromEmail')"><UInput v-model="state.fromEmail" type="email" class="w-full" /></UFormField>
        <UFormField name="defaultLocale" :label="t('admin.email.defaultLocale')"><USelect v-model="state.defaultLocale" :items="localeOptions" class="w-full" /></UFormField>
      </div>
      <UButton type="button" class="mt-4" color="neutral" variant="outline" icon="i-lucide-badge-check" :loading="busy" @click="checkProvider">{{ t('admin.email.validateProvider') }}</UButton>
    </UCard>
    <div class="flex justify-end"><UButton type="submit" icon="i-lucide-save" :loading="busy">{{ t('admin.email.saveProvider') }}</UButton></div>
  </UForm>
</template>
