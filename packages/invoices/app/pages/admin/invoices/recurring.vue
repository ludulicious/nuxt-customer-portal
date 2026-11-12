<script setup lang="ts">
import type { RecurringInvoiceDto } from '../../../../shared/recurring-invoice'

const { t } = useI18n()
const api = useInvoices()
const { data, error: bootstrapError } = await useAsyncData('invoices-recurring-bootstrap', () => api.adminBootstrap())
const listing = useInvoicesAdminList<RecurringInvoiceDto>({
  endpoint: '/api/invoices/admin/recurring',
  filterKeys: ['enabled'],
  defaultSort: 'name'
})
const creating = ref(false)
const editing = ref<string | null>(null)
watch(
  () => listing.items.value.map((item) => item.id),
  (ids) => {
    if (editing.value && !ids.includes(editing.value)) {
      editing.value = null
    }
  }
)
const filters = computed(() => [
  {
    key: 'enabled',
    placeholder: t('features.invoices.recurring.status'),
    items: [
      { label: t('features.invoices.recurring.all'), value: undefined },
      { label: t('features.invoices.recurring.active'), value: 'true' },
      { label: t('features.invoices.recurring.paused'), value: 'false' }
    ]
  }
])
const sorts = computed(() => [
  { label: t('features.invoices.recurring.name'), value: 'name' },
  { label: t('features.invoices.recurring.nextDate'), value: 'nextDate' }
])
const close = () => {
  creating.value = false
  editing.value = null
}
const openNew = () => {
  editing.value = null
  creating.value = true
}
const toggleEdit = (id: string) => {
  creating.value = false
  editing.value = editing.value === id ? null : id
}
const saved = async () => {
  close()
  await listing.refresh()
}
useSeoMeta({ title: () => t('features.invoices.recurring.title') })
if (data.value?.settings.enabled) {
  await listing.load()
}
</script>

<template>
  <section class="mx-auto flex h-full min-h-0 w-full max-w-[1440px] flex-col overflow-hidden p-4 sm:p-6 lg:p-8">
    <header class="mb-4 flex shrink-0 items-center justify-between gap-3 border-b border-default pb-4">
      <div class="flex min-w-0 gap-3">
        <UIcon name="i-lucide-repeat" class="mt-1 size-6 shrink-0 text-primary" />
        <div>
          <h1 class="text-2xl font-semibold">{{ t('features.invoices.recurring.title') }}</h1>
          <p class="mt-1 text-sm text-muted">{{ t('features.invoices.recurring.subtitle') }}</p>
        </div>
      </div>
      <UButton
        v-if="data?.settings.enabled && listing.pagination.value.total"
        icon="i-lucide-plus"
        size="sm"
        variant="outline"
        @click="openNew"
        >{{ t('features.invoices.recurring.new') }}</UButton
      >
    </header>
    <UAlert v-if="bootstrapError" color="error" :title="t('common.error')" />
    <UAlert
      v-else-if="data && !data.settings.enabled"
      color="neutral"
      variant="subtle"
      :title="t('features.invoices.recurring.disabled')"
    />
    <template v-else-if="data">
      <InvoicesAdminListToolbar
        v-model:search="listing.search.value"
        :filters="filters"
        :filter-values="listing.filters"
        :sort-options="sorts"
        :sort-by="listing.sortBy.value"
        :sort-dir="listing.sortDir.value"
        class="mb-4 shrink-0"
        @filter="listing.setFilter"
        @sort="listing.sortBy.value = $event"
        @toggle-direction="listing.toggleSortDir"
      />
      <UAlert
        v-if="listing.error.value"
        color="error"
        :title="t('common.error')"
        :description="String(listing.error.value.message)"
        class="mb-4"
      />
      <InvoicesAdminPaginatedList
        class="min-h-0 flex-1"
        total-records-key="features.invoices.recurring.totalRecords"
        :pagination="listing.pagination.value"
        :pending="listing.pending.value"
        :loading-next="listing.loadingNextPage.value"
        :loading-previous="listing.loadingPreviousPage.value"
        :has-next="listing.hasNextPage.value"
        :has-previous="listing.hasPreviousPage.value"
        @next="listing.loadNext"
        @previous="listing.loadPrevious"
        @page="listing.goToPage"
      >
        <div class="flex flex-col gap-3">
          <InvoicesRecurringForm v-if="creating" :data="data" @cancel="close" @saved="saved" />
          <InvoicesAdminEmptyState
            v-if="!creating && !listing.items.value.length && !listing.pending.value && !listing.error.value"
            icon="i-lucide-repeat"
            :title="t('features.invoices.recurring.empty')"
            :description="t('features.invoices.recurring.subtitle')"
            :action-label="t('features.invoices.recurring.new')"
            @action="openNew"
          />
          <template v-for="schedule in listing.items.value" :key="schedule.id">
            <article
              role="button"
              tabindex="0"
              :aria-expanded="editing === schedule.id"
              class="cursor-pointer rounded-lg border border-default p-4 hover:border-primary"
              @click="toggleEdit(schedule.id)"
              @keydown.enter.prevent="toggleEdit(schedule.id)"
              @keydown.space.prevent="toggleEdit(schedule.id)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="font-medium">{{ schedule.name }}</h2>
                  <p class="text-sm text-muted">
                    {{
                      data.clients.find((client) => client.organizationId === schedule.clientOrganizationId)?.name ??
                      schedule.clientOrganizationId
                    }}
                    · {{ t(`features.invoices.recurring.periods.${schedule.period}`) }}
                  </p>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <UBadge
                    :color="!schedule.enabled ? 'neutral' : schedule.nextDate ? 'primary' : 'success'"
                    variant="subtle"
                    >{{
                      t(
                        !schedule.enabled
                          ? 'features.invoices.recurring.paused'
                          : schedule.nextDate
                            ? 'features.invoices.recurring.active'
                            : 'features.invoices.recurring.completed'
                      )
                    }}</UBadge
                  ><UButton
                    icon="i-lucide-pencil"
                    color="neutral"
                    variant="ghost"
                    :aria-label="t('features.invoices.recurring.edit')"
                    @click.stop="toggleEdit(schedule.id)"
                    @keydown.stop
                  />
                </div>
              </div>
              <p class="mt-2 text-sm">
                {{ t('features.invoices.recurring.nextDate') }}: {{ schedule.nextDate ?? '—' }} ·
                {{ schedule.timeZone }}
              </p>
              <p v-if="schedule.lastGeneratedDate" class="text-sm text-muted">
                {{ t('features.invoices.recurring.lastGenerated') }}: {{ schedule.lastGeneratedDate }}
              </p>
              <UAlert
                v-if="schedule.lastError"
                class="mt-3"
                color="error"
                :title="t('features.invoices.recurring.generationError')"
              />
            </article>
            <InvoicesRecurringForm
              v-if="editing === schedule.id"
              :data="data"
              :initial="schedule"
              @cancel="close"
              @saved="saved"
            />
          </template>
        </div>
      </InvoicesAdminPaginatedList>
    </template>
  </section>
</template>
