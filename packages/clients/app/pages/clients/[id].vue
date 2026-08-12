<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const api = useClients()
const clientId = computed(() => String(route.params.id))
const returnTo = computed(() => {
  const value = Array.isArray(route.query.returnTo) ? route.query.returnTo[0] : route.query.returnTo
  return typeof value === 'string' && (value === '/clients' || value.startsWith('/clients?')) ? value : '/clients'
})
const { data: client, pending, error, refresh } = await useAsyncData(`client-${clientId.value}`, () => api.get(clientId.value))

useSeoMeta({
  title: computed(() => client.value?.name ?? t('features.clients.title'))
})

const handleDeleted = async () => {
  await navigateTo(returnTo.value)
}
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto">
    <div class="mx-auto flex max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <UButton :to="returnTo" variant="link" color="neutral" icon="i-lucide-arrow-left" class="w-fit px-0">
        {{ t('features.clients.backToClients') }}
      </UButton>

      <div v-if="pending" class="flex justify-center py-12" role="status">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
        <span class="sr-only">{{ t('features.clients.loading') }}</span>
      </div>
      <UAlert v-else-if="error" color="error" icon="i-lucide-circle-alert" :title="t('features.clients.notFound')" variant="outline" />
      <ClientsClientDetail v-else-if="client" :client="client" :refresh="refresh" @deleted="handleDeleted" />
    </div>
  </div>
</template>
