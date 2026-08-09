<script setup lang="ts">
import { z } from 'zod'
import type { InvoiceEmailPreviewDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

type EmailMode = 'issue' | 'resend' | 'reminder'

const props = defineProps<{ open: boolean, invoiceId: string, mode: EmailMode, refresh: () => Promise<unknown> }>()
const emit = defineEmits<{ 'update:open': [value: boolean], 'sent': [] }>()
const { t } = useI18n()
const api = useTimesheets()
const toast = useToast()
const { activeOrganizationRole, isSystemAdmin } = usePortalSession()
const canConfigureEmailProvider = computed(() => isSystemAdmin.value || activeOrganizationRole.value === 'owner')
const busy = ref(false)
const loadingPreview = ref(false)
const preview = ref<InvoiceEmailPreviewDto | null>(null)
const draft = reactive({ to: '', cc: '', locale: 'nl' as 'nl' | 'en', subject: '', body: '' })
const schema = computed(() => z.object({
  to: z.string().trim().email(t('features.timesheets.validation.validEmail')),
  cc: z.string().refine(value => !value.trim() || value.split(',').every(item => z.string().email().safeParse(item.trim()).success), t('features.timesheets.validation.validEmail')),
  locale: z.enum(['nl', 'en']),
  subject: z.string().trim().min(1, t('features.timesheets.validation.required')).max(500),
  body: z.string().trim().min(1, t('features.timesheets.validation.required')).max(10000)
}))
const titleKey = computed(() => props.mode === 'issue' ? 'features.timesheets.admin.issueAndSend' : props.mode === 'reminder' ? 'features.timesheets.admin.sendReminder' : 'features.timesheets.admin.resendInvoice')
const successKey = computed(() => props.mode === 'issue' ? 'features.timesheets.admin.invoiceIssuedAndSent' : props.mode === 'reminder' ? 'features.timesheets.admin.reminderSent' : 'features.timesheets.admin.invoiceResent')
const loadPreview = async (locale?: string) => {
  loadingPreview.value = true
  try {
    const result = props.mode === 'reminder'
      ? await api.getInvoiceReminderPreview(props.invoiceId, locale)
      : await api.getInvoiceEmailPreview(props.invoiceId, locale)
    preview.value = result
    Object.assign(draft, { to: result.to, cc: result.cc.join(', '), locale: result.locale === 'en' ? 'en' : 'nl', subject: result.subject, body: result.body })
  } catch (error) {
    emit('update:open', false)
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
  } finally {
    loadingPreview.value = false
  }
}
watch(() => props.open, (open) => {
  if (open) void loadPreview()
  else preview.value = null
})
const changeLocale = async () => {
  const recipient = draft.to
  const cc = draft.cc
  await loadPreview(draft.locale)
  draft.to = recipient
  draft.cc = cc
}
const send = async () => {
  busy.value = true
  try {
    const input = { ...draft, cc: draft.cc.split(',').map(item => item.trim()).filter(Boolean) }
    if (props.mode === 'issue') await api.issueAndSendInvoice(props.invoiceId, input)
    else if (props.mode === 'reminder') await api.sendInvoiceReminder(props.invoiceId, input)
    else await api.resendInvoice(props.invoiceId, input)
    await props.refresh()
    toast.add({ title: t(successKey.value), color: 'success' })
    emit('sent')
    emit('update:open', false)
  } catch (error) {
    toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal :open="open" :title="t(titleKey)" @update:open="emit('update:open', $event)">
    <template #body>
      <div v-if="loadingPreview" class="flex justify-center py-10" role="status"><UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" /><span class="sr-only">{{ t('features.timesheets.loading') }}</span></div>
      <UForm v-else :state="draft" :schema="schema" class="space-y-4" @submit="send">
        <UAlert v-if="preview && !preview.emailProviderConfigured" color="error" icon="i-lucide-key-round" :title="t('features.timesheets.admin.emailProviderNotConfigured')" variant="outline" >
          <template #description><p>{{ t(canConfigureEmailProvider ? 'features.timesheets.admin.emailProviderConfigureDescription' : 'features.timesheets.admin.emailProviderContactOwner') }}</p><UButton v-if="canConfigureEmailProvider" to="/settings/organization" color="neutral" variant="solid" size="xs" icon="i-lucide-settings" class="mt-2">{{ t('features.timesheets.admin.emailProviderOpenSettings') }}</UButton></template>
        </UAlert>
        <UAlert v-else-if="preview && !preview.senderDomainVerified" color="error" icon="i-lucide-shield-alert" :title="t('features.timesheets.admin.emailDomainUnverified')" variant="outline" >
          <template #description><p>{{ preview.senderDomain }}</p><UButton to="https://resend.com/docs/dashboard/domains/introduction" target="_blank" rel="noopener noreferrer" color="neutral" variant="solid" size="xs" trailing-icon="i-lucide-external-link" class="mt-2">{{ t('features.timesheets.admin.emailDomainVerificationHelp') }}</UButton></template>
        </UAlert>
        <UAlert v-if="preview && preview.totalAttachmentSize > preview.maximumAttachmentSize" color="error" icon="i-lucide-file-warning" :title="t('features.timesheets.admin.emailAttachmentsTooLarge')" variant="outline" />
        <div class="grid gap-3 sm:grid-cols-2"><UFormField name="to" :label="t('features.timesheets.admin.recipientEmail')"><UInput v-model="draft.to" type="email" class="w-full" /></UFormField><UFormField name="cc" label="CC"><UInput v-model="draft.cc" :placeholder="t('features.timesheets.admin.ccPlaceholder')" class="w-full" /></UFormField></div>
        <UFormField name="locale" :label="t('features.timesheets.admin.emailLanguage')"><USelect v-model="draft.locale" :items="[{ label: t('features.timesheets.languages.nl'), value: 'nl' }, { label: t('features.timesheets.languages.en'), value: 'en' }]" value-key="value" class="w-full" @update:model-value="changeLocale" /></UFormField>
        <UFormField name="subject" :label="t('features.timesheets.admin.emailSubject')"><UInput v-model="draft.subject" class="w-full" /></UFormField>
        <UFormField name="body" :label="t('features.timesheets.admin.emailBody')"><UTextarea v-model="draft.body" :rows="8" class="w-full" /></UFormField>
        <div><p class="text-sm font-medium">{{ t('features.timesheets.admin.emailAttachments') }}</p><ul class="mt-2 space-y-1 text-sm text-muted"><li v-for="file in preview?.attachments" :key="file.fileName">{{ file.fileName }} · {{ Math.ceil(file.size / 1024) }} KB</li></ul></div>
        <div class="flex justify-end gap-2"><UButton type="button" color="neutral" variant="ghost" @click="emit('update:open', false)">{{ t('features.timesheets.cancel') }}</UButton><UButton type="submit" icon="i-lucide-send" :loading="busy" :disabled="!preview?.emailProviderConfigured || !preview?.senderDomainVerified || (preview?.totalAttachmentSize ?? 0) > (preview?.maximumAttachmentSize ?? 0)">{{ t(props.mode === 'reminder' ? 'features.timesheets.admin.sendReminder' : 'features.timesheets.admin.sendEmail') }}</UButton></div>
      </UForm>
    </template>
  </UModal>
</template>
