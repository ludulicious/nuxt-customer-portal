<script setup lang="ts">
import { z } from 'zod'
import type { GenericClientDto } from '@nuxt-customer-portal/clients/types'
import type { InvoiceContactDto } from '@nuxt-customer-portal/invoices/shared/types/invoice'

const props = defineProps<{ client: GenericClientDto }>()
const { t } = useI18n()
const toast = useToast()
const busy = ref(false)
const editingId = ref('')
const formOpen = ref(false)
const state = reactive({ name: '', email: '', phone: '', jobTitle: '' })
const schema = computed(() =>
  z.object({
    name: z
      .string()
      .trim()
      .min(1, t('features.invoices.validation.required'))
      .max(200, t('features.invoices.validation.maxLength', { count: 200 })),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, t('features.invoices.validation.required'))
      .email(t('features.invoices.validation.validEmail'))
      .max(320, t('features.invoices.validation.maxLength', { count: 320 })),
    phone: z
      .string()
      .trim()
      .max(80, t('features.invoices.validation.maxLength', { count: 80 })),
    jobTitle: z
      .string()
      .trim()
      .max(160, t('features.invoices.validation.maxLength', { count: 160 }))
  })
)
const endpoint = `/api/invoices/admin/clients/${props.client.organizationId}/contacts`
const { data: contacts, refresh } = await useFetch<InvoiceContactDto[]>(endpoint, { default: () => [] })
const reset = () => {
  editingId.value = ''
  formOpen.value = false
  Object.assign(state, { name: '', email: '', phone: '', jobTitle: '' })
}
const edit = (contact: InvoiceContactDto) => {
  editingId.value = contact.id
  formOpen.value = true
  Object.assign(state, {
    name: contact.name,
    email: contact.email,
    phone: contact.phone ?? '',
    jobTitle: contact.jobTitle ?? ''
  })
}
const save = async () => {
  busy.value = true
  try {
    const validated = schema.value.parse(state)
    const body = { ...validated, phone: validated.phone || null, jobTitle: validated.jobTitle || null }
    if (editingId.value) {
      await $fetch(`${endpoint}/${editingId.value}`, { method: 'PATCH', body })
    } else {
      await $fetch(endpoint, { method: 'POST', body })
    }
    await refresh()
    reset()
    toast.add({ title: t('features.invoices.messages.saved'), color: 'success' })
  } catch (error) {
    toast.add({ title: t('features.invoices.messages.saveError'), description: String(error), color: 'error' })
  } finally {
    busy.value = false
  }
}
const remove = async (contact: InvoiceContactDto) => {
  await $fetch(`${endpoint}/${contact.id}`, { method: 'DELETE' })
  await refresh()
}
</script>

<template>
  <div class="space-y-6">
    <InvoicesClientAccessPanel :client="client" />
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold">{{ t('features.invoices.admin.contactPersons') }}</h2>
            <p class="text-sm text-muted">{{ t('features.invoices.admin.noContactsDescription') }}</p>
          </div>
          <UButton
            v-if="!formOpen"
            type="button"
            size="sm"
            variant="outline"
            icon="i-lucide-plus"
            @click="formOpen = true"
          >
            {{ t('features.invoices.admin.addContact') }}
          </UButton>
        </div>
      </template>
      <div class="grid gap-2">
        <div
          v-for="contact in contacts"
          :key="contact.id"
          class="flex items-center justify-between gap-3 rounded-md border border-default p-3"
        >
          <div>
            <p class="font-medium">{{ contact.name }}</p>
            <p class="text-sm text-muted">{{ contact.email }}</p>
          </div>
          <div class="flex gap-1">
            <UButton type="button" variant="ghost" icon="i-lucide-pencil" @click="edit(contact)" /><UButton
              type="button"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              @click="remove(contact)"
            />
          </div>
        </div>
        <p v-if="!contacts.length && !formOpen" class="text-sm text-muted">
          {{ t('features.invoices.admin.noContactsTitle') }}
        </p>
        <UForm
          v-if="formOpen"
          :state="state"
          :schema="schema"
          novalidate
          class="grid gap-3 md:grid-cols-2"
          @submit="save"
        >
          <UFormField name="name" :label="t('features.invoices.admin.name')" required>
            <UInput v-model="state.name" class="w-full" /> </UFormField
          ><UFormField name="email" :label="t('features.invoices.admin.email')" required>
            <UInput v-model="state.email" type="email" class="w-full" /> </UFormField
          ><UFormField name="phone" :label="t('features.invoices.admin.phone')">
            <UInput v-model="state.phone" class="w-full" /> </UFormField
          ><UFormField name="jobTitle" :label="t('features.invoices.admin.jobTitle')">
            <UInput v-model="state.jobTitle" class="w-full" />
          </UFormField>
          <div class="flex justify-end gap-2 md:col-span-2">
            <UButton type="button" color="neutral" variant="outline" @click="reset">
              {{ t('features.invoices.cancel') }} </UButton
            ><UButton type="submit" :loading="busy">{{ t('features.invoices.save') }}</UButton>
          </div>
        </UForm>
      </div>
    </UCard>
  </div>
</template>
