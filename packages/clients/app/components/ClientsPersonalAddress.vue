<script setup lang="ts">
import { z } from 'zod'

const { t } = useI18n()
const api = useClients()
const { data: client, error: loadError } = await useAsyncData('own-personal-address', () => api.personalAddress())
const state = reactive({ address: client.value?.address ?? '' })
const schema = computed(() => z.object({ address: z.string().trim().max(1000, t('features.clients.addressTooLong')) }))
const busy = ref(false)
const error = ref(false)
const toast = useToast()
watch(client, (value) => {
  state.address = value?.address ?? ''
})
async function save() {
  busy.value = true
  error.value = false
  try {
    client.value = await api.updatePersonalAddress(state.address)
    toast.add({ title: t('features.clients.addressSaved'), color: 'success' })
  } catch {
    error.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UAlert v-if="loadError" class="mb-8" color="error" :title="t('features.clients.addressLoadFailed')" />
  <AppCard v-else-if="client" class="mb-8" :title="t('features.clients.personalAddress')">
    <UForm :schema="schema" :state="state" novalidate class="space-y-4" @submit="save">
      <UFormField
        name="address"
        :label="t('features.clients.address')"
        :description="t('features.clients.personalAddressDescription')"
      >
        <UTextarea
          v-model="state.address"
          autocomplete="street-address"
          class="w-full"
          :rows="3"
          :disabled="client.archived"
        />
      </UFormField>
      <UAlert v-if="client.archived" color="warning" :title="t('features.clients.archived')" />
      <UAlert v-if="error" color="error" :title="t('features.clients.saveFailed')" />
      <UButton type="submit" :loading="busy" :disabled="client.archived || state.address === client.address">{{
        t('features.clients.save')
      }}</UButton>
    </UForm>
  </AppCard>
</template>
