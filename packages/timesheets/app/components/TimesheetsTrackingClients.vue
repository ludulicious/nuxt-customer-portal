<script setup lang="ts">
import type { GenericClientDto } from '@nuxt-customer-portal/clients/types'

const { t } = useI18n()
const prefix = 'features.timesheets.trackingClients.'
const api = useClients()
const toast = useToast()
const { activeOrganizationType, activeOrganizationRole } = usePortalSession()
const canManage = computed(
  () => activeOrganizationType.value === 'PROVIDER' && ['owner', 'admin'].includes(activeOrganizationRole.value ?? '')
)
type TrackingClient = GenericClientDto & { enabled: boolean }
const { data, pending, error, refresh } = await useAsyncData('timesheets-tracking-clients', async () => {
  const clients = new Map<string, TrackingClient>()
  let page = 1
  while (true) {
    const result = await api.list({ status: 'active', page, pageSize: 100, sortBy: 'name', sortDir: 'asc' })
    for (const client of result.items) {
      if (!client.archivedAt) {
        clients.set(client.id, {
          ...client,
          enabled: client.modules.some((module) => module.moduleId === 'timesheets' && module.enabled)
        })
      }
    }
    if (!result.pagination.hasNext) {
      break
    }
    page++
  }
  return [...clients.values()].sort((a, b) => a.name.localeCompare(b.name))
})
const tracked = computed(() => data.value?.filter((client) => client.enabled) ?? [])
const route = useRoute()
const router = useRouter()
const selectedClientId = computed({
  get: () => tracked.value.find((client) => client.id === route.query.client)?.id ?? '',
  set: (clientId: string) => {
    void router.replace({ query: { ...route.query, client: clientId || undefined } })
  }
})
const search = computed({
  get: () => String(route.query.search ?? ''),
  set: (value: string) => {
    void router.replace({ query: { ...route.query, search: value || undefined } })
  }
})
const sortDir = computed(() => (route.query.direction === 'desc' ? 'desc' : 'asc'))
const trackingFilter = computed(() =>
  ['on', 'off'].includes(String(route.query.tracking)) ? String(route.query.tracking) : undefined
)
const visibleClients = computed(() =>
  (data.value ?? [])
    .filter((client) => !trackingFilter.value || client.enabled === (trackingFilter.value === 'on'))
    .filter((client) => client.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name) * (sortDir.value === 'asc' ? 1 : -1))
)
const toggleClient = (id: string) => {
  selectedClientId.value = selectedClientId.value === id ? '' : id
}
onKeyStroke('Escape', () => {
  selectedClientId.value = ''
})
const busyId = ref<string | null>(null)
const update = async (id: string, enabled: boolean) => {
  if (!canManage.value || busyId.value) {
    return
  }
  busyId.value = id
  try {
    await api.setModule(id, 'timesheets', enabled)
    if (!enabled && selectedClientId.value === id) {
      selectedClientId.value = ''
    }
    await refresh()
    clearNuxtData((key) => key.startsWith('client-review-periods:'))
    clearNuxtData('timesheet-week')
    clearNuxtData('timesheets-dashboard')
  } catch {
    toast.add({ title: t(prefix + 'error'), color: 'error' })
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <section class="space-y-4" :aria-label="t(prefix + 'title')">
    <USkeleton v-if="pending && !data" class="h-8 w-48" />
    <UAlert v-else-if="error" color="error" :title="t(prefix + 'loadError')">
      <template #actions
        ><UButton color="neutral" variant="outline" @click="refresh()">{{
          t('features.timesheets.reviewPeriods.retry')
        }}</UButton></template
      >
    </UAlert>
    <template v-else>
      <PortalListToolbar
        v-if="data?.length"
        v-model:search="search"
        :search-placeholder="t(prefix + 'search')"
        :filters="[
          {
            key: 'tracking',
            placeholder: t(prefix + 'all'),
            items: [
              { label: t(prefix + 'all'), value: undefined },
              { label: t(prefix + 'on'), value: 'on' },
              { label: t(prefix + 'off'), value: 'off' }
            ]
          }
        ]"
        :filter-values="{ tracking: trackingFilter }"
        :sort-options="[{ label: t(prefix + 'name'), value: 'name' }]"
        sort-by="name"
        :sort-dir="sortDir"
        @filter="
          (_key: string, value: string | undefined) => router.replace({ query: { ...route.query, tracking: value } })
        "
        @toggle-direction="
          router.replace({ query: { ...route.query, direction: sortDir === 'asc' ? 'desc' : undefined } })
        "
      />
      <UEmpty v-if="!data?.length" icon="i-lucide-building-2" :title="t(prefix + 'empty')" variant="outline" />
      <p v-else-if="!visibleClients.length" class="text-sm text-muted">{{ t(prefix + 'noResults') }}</p>
      <div class="grid gap-3">
        <div v-for="client in visibleClients" :key="client.id" class="space-y-3">
          <UCard :class="selectedClientId === client.id ? 'ring-primary' : 'hover:ring-primary/50'">
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-3 text-left rounded-md focus-visible:outline-2 focus-visible:outline-primary"
                :aria-expanded="selectedClientId === client.id"
                :disabled="!client.enabled"
                @click="toggleClient(client.id)"
              >
                <UAvatar :src="client.avatarLogo || client.logo || undefined" :alt="client.name" size="md" />
                <span class="truncate font-semibold">{{ client.name }}</span>
              </button>
              <UButton
                v-if="client.enabled"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="t(prefix + 'edit', { name: client.name })"
                @click="toggleClient(client.id)"
              />
              <USwitch
                v-if="canManage"
                :model-value="client.enabled"
                :label="t(prefix + 'title')"
                :disabled="Boolean(busyId)"
                :aria-label="t(prefix + 'toggle', { name: client.name })"
                @update:model-value="update(client.id, $event)"
              />
            </div>
          </UCard>
          <Suspense :timeout="-1">
            <TimesheetsClientSettingsPanel
              v-if="selectedClientId === client.id"
              :key="client.id"
              :client="client"
              show-client
              @close="selectedClientId = ''"
            />
            <template #fallback><USkeleton class="h-64 w-full" /></template>
          </Suspense>
        </div>
      </div>
    </template>
  </section>
</template>
