<script setup lang="ts">
import { z } from 'zod'
import type { InvoiceRecipientPreviewDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'

const props = defineProps<{ invoiceId: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const api = useInvoices()
const toast = useToast()
const preview = ref<InvoiceRecipientPreviewDto | null>(null)
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const state = reactive({ contactId: '__none__' })
const schema = z.object({ contactId: z.string().min(1).max(200) })
const contactOptions = computed(() => [
  { label: t('features.invoices.admin.noRecipientContact'), value: '__none__' },
  ...(preview.value?.contacts.map((contact) => ({ label: `${contact.name} · ${contact.email}`, value: contact.id })) ??
    [])
])
const errorText = (error: unknown) => (error as { data?: { message?: string } }).data?.message || String(error)
const load = async () => {
  loading.value = true
  errorMessage.value = ''
  try {
    preview.value = await api.getInvoiceRecipient(props.invoiceId)
    state.contactId = preview.value.suggestedContactId || '__none__'
  } catch (error) {
    errorMessage.value = errorText(error)
  } finally {
    loading.value = false
  }
}
const save = async () => {
  if (saving.value) {
    return
  }
  saving.value = true
  errorMessage.value = ''
  try {
    await api.refreshInvoiceRecipient(props.invoiceId, state.contactId === '__none__' ? null : state.contactId)
    emit('saved')
    open.value = false
    toast.add({ title: t('features.invoices.admin.recipientRefreshed'), color: 'success' })
  } catch (error) {
    errorMessage.value = errorText(error)
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>

<template>
  <UModal v-if="open" v-model:open="open" :title="t('features.invoices.admin.refreshRecipient')">
    <template #body>
      <div v-if="loading" class="flex justify-center py-8" role="status">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
        <span class="sr-only">{{ t('features.invoices.admin.loadingRecipient') }}</span>
      </div>
      <div v-else class="space-y-4">
        <UAlert v-if="errorMessage" color="error" icon="i-lucide-circle-alert" :title="errorMessage" />
        <UButton v-if="!preview" variant="outline" @click="load">{{
          t('features.invoices.admin.retryRecipient')
        }}</UButton>
        <UForm v-if="preview" :state="state" :schema="schema" novalidate class="space-y-4" @submit="save">
          <p class="text-sm text-muted">{{ t('features.invoices.admin.refreshRecipientDescription') }}</p>
          <div>
            <p class="font-semibold">{{ preview.recipientName }}</p>
            <p class="whitespace-pre-line text-sm">{{ preview.recipientAddress }}</p>
            <p v-if="preview.recipientEmail" class="mt-2 text-sm">{{ preview.recipientEmail }}</p>
          </div>
          <UFormField
            v-if="preview.clientType === 'organization'"
            name="contactId"
            :label="t('features.invoices.admin.recipientContact')"
          >
            <USelect v-model="state.contactId" :items="contactOptions" :disabled="saving" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="outline" :disabled="saving" @click="open = false">{{
              t('features.invoices.cancel')
            }}</UButton>
            <UButton type="submit" :loading="saving">{{ t('features.invoices.admin.refreshRecipient') }}</UButton>
          </div>
        </UForm>
      </div>
    </template>
  </UModal>
</template>
