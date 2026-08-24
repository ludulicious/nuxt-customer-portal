<script setup lang="ts">
import { z } from 'zod'
import type { GenericClientDto } from '@nuxt-customer-portal/clients/shared/types/client'

const props = defineProps<{ client?: GenericClientDto | null; busy?: boolean; editing?: boolean }>()
const emit = defineEmits<{ submit: [value: Record<string, unknown>]; cancel: [] }>()
const { t } = useI18n()
const form = reactive({
  name: '',
  slug: '',
  officialName: '',
  address: '',
  registrationNumber: '',
  vatNumber: '',
  invoiceEmail: '',
  preferredLocale: 'nl' as 'nl' | 'en'
})
const schema = computed(() =>
  z.object({
    name: z.string().trim().min(2, t('features.clients.validation.name')).max(160),
    slug: props.editing
      ? z.string()
      : z
          .string()
          .trim()
          .min(1, t('features.clients.validation.slug'))
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t('features.clients.validation.slug')),
    officialName: z.string().trim().min(2, t('features.clients.validation.officialName')).max(200),
    address: z.string().trim().max(1000),
    registrationNumber: z.string().trim().max(200),
    vatNumber: z.string().trim().max(100),
    invoiceEmail: z.union([z.literal(''), z.string().trim().email(t('features.clients.validation.email')).max(320)]),
    preferredLocale: z.enum(['nl', 'en'])
  })
)
const reset = () =>
  Object.assign(
    form,
    props.client
      ? {
          name: props.client.name,
          slug: props.client.slug,
          officialName: props.client.officialName,
          address: props.client.address,
          registrationNumber: props.client.registrationNumber ?? '',
          vatNumber: props.client.vatNumber ?? '',
          invoiceEmail: props.client.invoiceEmail ?? '',
          preferredLocale: props.client.preferredLocale
        }
      : {
          name: '',
          slug: '',
          officialName: '',
          address: '',
          registrationNumber: '',
          vatNumber: '',
          invoiceEmail: '',
          preferredLocale: 'nl'
        }
  )
watch(() => props.client, reset, { immediate: true })
const submit = () =>
  emit('submit', {
    name: form.name.trim(),
    ...(props.editing ? {} : { slug: form.slug.trim() }),
    officialName: form.officialName.trim(),
    address: form.address.trim(),
    registrationNumber: form.registrationNumber.trim() || null,
    vatNumber: form.vatNumber.trim() || null,
    invoiceEmail: form.invoiceEmail.trim().toLowerCase() || null,
    preferredLocale: form.preferredLocale
  })
</script>

<template>
  <UCard class="scroll-mt-24">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ t(editing ? 'features.clients.editTitle' : 'features.clients.createTitle') }}</h2>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          icon="i-lucide-x"
          :aria-label="t('features.clients.close')"
          @click="emit('cancel')"
        />
      </div>
    </template>
    <UForm :state="form" :schema="schema" class="space-y-4" @submit="submit">
      <div class="grid gap-4 md:grid-cols-2">
        <UFormField name="name" :label="t('features.clients.name')" required>
          <UInput v-model="form.name" class="w-full" />
        </UFormField>
        <UFormField name="slug" :label="t('features.clients.slug')" :required="!editing">
          <UInput v-model="form.slug" :disabled="editing" class="w-full" />
        </UFormField>
        <UFormField name="officialName" :label="t('features.clients.officialName')" required>
          <UInput v-model="form.officialName" class="w-full" />
        </UFormField>
        <UFormField name="invoiceEmail" :label="t('features.clients.invoiceEmail')">
          <UInput v-model="form.invoiceEmail" type="email" class="w-full" />
        </UFormField>
        <UFormField name="registrationNumber" :label="t('features.clients.registrationNumber')">
          <UInput v-model="form.registrationNumber" class="w-full" />
        </UFormField>
        <UFormField name="vatNumber" :label="t('features.clients.vatNumber')">
          <UInput v-model="form.vatNumber" class="w-full" />
        </UFormField>
        <UFormField name="preferredLocale" :label="t('features.clients.locale')">
          <USelect
            v-model="form.preferredLocale"
            :items="[
              { label: 'Nederlands', value: 'nl' },
              { label: 'English', value: 'en' }
            ]"
            value-key="value"
            class="w-full"
          />
        </UFormField>
      </div>
      <UFormField name="address" :label="t('features.clients.address')">
        <UTextarea v-model="form.address" class="w-full" />
      </UFormField>
      <div class="flex justify-end gap-2">
        <UButton type="button" color="neutral" variant="outline" @click="emit('cancel')">
          {{ t('features.clients.cancel') }}
        </UButton>
        <UButton type="submit" :loading="busy" icon="i-lucide-save">
          {{ t(editing ? 'features.clients.save' : 'features.clients.create') }}
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
