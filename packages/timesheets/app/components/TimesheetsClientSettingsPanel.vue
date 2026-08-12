<script setup lang="ts">
import { z } from 'zod'
import type { GenericClientDto } from '@nuxt-customer-portal/clients/types'

const props = defineProps<{ client: GenericClientDto }>()
const { t } = useI18n()
const toast = useToast()
const busy = ref(false)
const state = reactive({ accessMode: 'DISABLED' as 'DISABLED' | 'VIEW' | 'REVIEW', invoiceAccessEnabled: false })
const schema = z.object({ accessMode: z.enum(['DISABLED', 'VIEW', 'REVIEW']), invoiceAccessEnabled: z.boolean() })
const { data } = await useFetch(`/api/timesheets/admin/client-settings/${props.client.organizationId}`)
if (data.value) Object.assign(state, data.value)
const save = async () => {
  busy.value = true
  try {
    await $fetch(`/api/timesheets/admin/client-settings/${props.client.organizationId}`, { method: 'PUT', body: state })
    toast.add({ title: t('features.timesheets.messages.saved'), color: 'success' })
  } finally { busy.value = false }
}
</script>

<template>
  <UCard>
    <template #header><h2 class="font-semibold">{{ t('features.timesheets.admin.clientSettings') }}</h2></template>
    <UForm :state="state" :schema="schema" class="space-y-4" @submit="save">
      <UFormField name="accessMode" :label="t('features.timesheets.timesheetAccess')"><USelect v-model="state.accessMode" :items="[{ label: t('features.timesheets.clientAccess.disabled'), value: 'DISABLED' }, { label: t('features.timesheets.clientAccess.view'), value: 'VIEW' }, { label: t('features.timesheets.clientAccess.review'), value: 'REVIEW' }]" value-key="value" class="w-full" /></UFormField>
      <UFormField name="invoiceAccessEnabled"><USwitch v-model="state.invoiceAccessEnabled" :label="t('features.timesheets.clientInvoices.enableAccess')" /></UFormField>
      <div class="flex justify-end"><UButton type="submit" icon="i-lucide-save" :loading="busy">{{ t('features.timesheets.save') }}</UButton></div>
    </UForm>
  </UCard>
</template>
