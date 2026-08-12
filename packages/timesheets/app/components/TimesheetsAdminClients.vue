<script setup lang="ts">
import type { DeepReadonly } from 'vue'
import type { TimesheetsAdminBootstrap } from '@nuxt-customer-portal/timesheets/app/composables/useTimesheets'
import type { ClientAccessMode, ClientDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const props = defineProps<{ data: TimesheetsAdminBootstrap, refresh: () => Promise<unknown> }>()
const { t } = useI18n()
const toast = useToast()
const api = useTimesheets()
const busy = ref(false)
const formOpen = ref(false)
const newClient = reactive({ mode: (props.data.availableClientOrganizations.length ? 'link' : 'create') as 'link' | 'create', organizationId: '', name: '', slug: '' })
const listing = useTimesheetsAdminList<ClientDto>({ endpoint: '/api/timesheets/admin/clients', filterKeys: ['configured'], defaultSort: 'name' })
const clients = listing.items
const clientFilters = computed(() => [{ key: 'configured', placeholder: t('features.timesheets.admin.list.configurationFilter'), items: [{ label: t('features.timesheets.admin.list.allConfigurations'), value: undefined }, { label: t('features.timesheets.admin.list.configured'), value: 'configured' }, { label: t('features.timesheets.admin.list.incomplete'), value: 'incomplete' }] }])
const sortOptions = computed(() => [{ label: t('features.timesheets.admin.list.sortName'), value: 'name' }])
const run = async (operation: () => Promise<unknown>) => {
  busy.value = true
  try { await operation(); await props.refresh(); await listing.refresh() } catch (error) { toast.add({ title: t('features.timesheets.messages.saveError'), description: String(error), color: 'error' }) } finally { busy.value = false }
}
const saveClient = () => run(async () => {
  const input = newClient.mode === 'create'
    ? { mode: 'create' as const, name: newClient.name, slug: newClient.slug }
    : { mode: 'link' as const, organizationId: newClient.organizationId }
  await api.createClient(input)
  Object.assign(newClient, { mode: props.data.availableClientOrganizations.length ? 'link' : 'create', organizationId: '', name: '', slug: '' })
  formOpen.value = false
})
const removeClient = (client: DeepReadonly<ClientDto>) => run(() => api.deleteClient(client.id, client.name))
const changeClientAccess = async (id: string, value: string) => { await api.updateClientAccess(id, value as ClientAccessMode); await listing.refresh() }
defineExpose({
  canCreate: computed(() => true),
  openCreate: () => { formOpen.value = true },
  refreshList: () => listing.refresh(),
  showCreate: computed(() => Boolean(clients.value.length) && !formOpen.value)
})
await listing.load()
</script>

<template>
  <section class="flex h-full min-h-0 flex-col gap-4">
    <TimesheetsAdminListToolbar v-model:search="listing.search.value" :filters="clientFilters" :filter-values="listing.filters" :sort-options="sortOptions" :sort-by="listing.sortBy.value" :sort-dir="listing.sortDir.value" @filter="listing.setFilter" @sort="listing.sortBy.value = $event" @toggle-direction="listing.toggleSortDir" />
    <TimesheetsAdminPaginatedList class="min-h-0 flex-1" :pagination="listing.pagination.value" :pending="listing.pending.value" :loading-next="listing.loadingNextPage.value" :loading-previous="listing.loadingPreviousPage.value" :has-next="listing.hasNextPage.value" :has-previous="listing.hasPreviousPage.value" @next="listing.loadNext" @previous="listing.loadPrevious" @page="listing.goToPage">
      <TimesheetsAdminEmptyState v-if="!clients.length && !formOpen && !listing.pending.value" icon="i-lucide-building-2" :title="t('features.timesheets.admin.noClientsTitle')" :description="t('features.timesheets.admin.noClientsDescription')" :action-label="t('features.timesheets.admin.createFirstClient')" @action="formOpen = true" />
      <div class="grid gap-3">
        <TimesheetsClientForm v-if="formOpen" v-model="newClient" :data="data" :busy="busy" :show-cancel="true" @submit="saveClient" @cancel="formOpen = false" />
        <UCard v-for="client in clients" :key="client.id">
          <div class="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_auto] sm:items-center">
            <div class="flex min-w-0 items-center gap-3"><UAvatar :src="client.logo ?? undefined" :alt="client.name" /><div class="min-w-0"><p class="truncate font-medium">{{ client.name }}</p><p class="truncate text-sm text-muted">{{ client.officialName || client.slug }}</p></div></div>
            <label class="grid gap-1 text-xs text-muted"><span>{{ t('features.timesheets.timesheetAccess') }}</span><USelect :model-value="client.accessMode" :items="[{ label: t('features.timesheets.clientAccess.disabled'), value: 'DISABLED' }, { label: t('features.timesheets.clientAccess.view'), value: 'VIEW' }, { label: t('features.timesheets.clientAccess.review'), value: 'REVIEW' }]" value-key="value" @update:model-value="changeClientAccess(client.id, $event)" /></label>
            <UButton type="button" color="error" variant="ghost" icon="i-lucide-trash-2" :aria-label="t('features.timesheets.admin.removeClient')" @click="removeClient(client)" />
          </div>
        </UCard>
      </div>
    </TimesheetsAdminPaginatedList>
  </section>
</template>
