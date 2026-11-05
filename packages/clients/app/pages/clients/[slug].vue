<script setup lang="ts">
import type { GenericClientDto } from '@nuxt-customer-portal/clients/shared/types/client'

const route = useRoute()
const { t } = useI18n()
const api = useClients()
const clientSlug = computed(() => String(route.params.slug))
const returnTo = computed(() => {
  const value = Array.isArray(route.query.returnTo) ? route.query.returnTo[0] : route.query.returnTo
  return typeof value === 'string' && (value === '/clients' || value.startsWith('/clients?')) ? value : '/clients'
})
const {
  data: client,
  pending,
  error,
  refresh
} = await useAsyncData(
  () => `client-${clientSlug.value}`,
  () => api.resolve(clientSlug.value)
)

const canonicalClientUrl = (selected: GenericClientDto) => ({
  path: `/clients/${encodeURIComponent(selected.slug)}`,
  query: route.query,
  hash: route.hash
})
if (client.value && clientSlug.value !== client.value.slug) {
  await navigateTo(canonicalClientUrl(client.value), { replace: true, redirectCode: 302 })
}
const handleUpdated = async (updated: GenericClientDto) => {
  client.value = updated
  if (clientSlug.value !== updated.slug || route.query.edit !== undefined) {
    const target = canonicalClientUrl(updated)
    target.query = { ...target.query }
    delete target.query.edit
    await navigateTo(target, { replace: true })
  }
}

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
      <UAlert
        v-else-if="error"
        color="error"
        icon="i-lucide-circle-alert"
        :title="t('features.clients.notFound')"
        variant="outline"
      />
      <ClientsClientDetail
        v-else-if="client"
        :client="client"
        :refresh="refresh"
        :start-editing="route.query.edit === 'true'"
        @deleted="handleDeleted"
        @updated="handleUpdated"
      />
    </div>
  </div>
</template>
