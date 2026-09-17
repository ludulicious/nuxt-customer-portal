<script setup lang="ts">
const props = defineProps<{ clientId: string }>()
const api = useClients()
const { t } = useI18n()
const { data: client, refresh } = await useAsyncData(
  () => `personal-profile-${props.clientId}`,
  () => api.get(props.clientId),
  { watch: [() => props.clientId] }
)
const busy = ref(false)
const error = ref('')
const editing = ref(false)
const save = async (input: Record<string, unknown>) => {
  busy.value = true
  error.value = ''
  try {
    await api.update(props.clientId, input)
    await refresh()
    editing.value = false
  } catch {
    error.value = t('features.clients.saveFailed')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <UAlert v-if="error" color="error" :title="error" />
    <ClientsClientForm
      v-if="client && editing"
      :client="client"
      editing
      :busy="busy"
      @submit="save"
      @cancel="editing = false"
    />
    <UCard v-else-if="client"
      ><h2 class="font-semibold">{{ t('features.clients.personalAccount') }} · {{ client.name }}</h2>
      <p>{{ client.invoiceEmail }}</p>
      <p>{{ client.schedulingTimezone }}</p>
      <UButton class="mt-4" @click="editing = true">{{ t('features.clients.editPersonalProfile') }}</UButton></UCard
    >
  </div>
</template>
