<script setup lang="ts">
import type { ServiceRequest } from '@nuxt-customer-portal/service-requests/shared/types/service-request'

const route = useRoute()
const { t, locale } = useI18n()
const { can } = useServiceRequestAccess()
const isAdmin = computed(() => can('manage'))
const { statusOptions, priorityOptions, getStatusColor, getStatusBadgeText, getPriorityColor, getPriorityBadgeText } =
  useServiceRequests()
const listing = useServiceRequestList({
  endpoint: '/api/service-requests',
  filterKeys: ['status', 'priority', 'category'],
  defaultSort: 'createdAt',
  defaultSortDir: 'desc'
})
const title = computed(() => t('features.serviceRequests.title'))
useSeoMeta({ title: () => title.value })
const filters = computed(() => [
  { key: 'status', placeholder: t('features.serviceRequests.filters.status'), items: statusOptions.value },
  { key: 'priority', placeholder: t('features.serviceRequests.filters.priority'), items: priorityOptions.value },
  {
    key: 'category',
    placeholder: t('features.serviceRequests.filters.category'),
    items: [
      { label: t('features.serviceRequests.filters.allCategories'), value: undefined },
      ...Array.from(
        new Set([...listing.categories.value, ...(listing.filters.category ? [listing.filters.category] : [])])
      ).map((value) => ({ label: value, value }))
    ]
  }
])
const sortOptions = computed(() =>
  ['createdAt', 'status', 'priority'].map((value) => ({ label: t(`features.serviceRequests.fields.${value}`), value }))
)
const filtered = computed(() => Boolean(listing.search.value.trim() || Object.values(listing.filters).some(Boolean)))
const detailTo = (request: ServiceRequest) => ({
  path: `/requests/${request.id}`,
  query: { ...route.query, from: 'list' }
})
const formatDate = (date: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(new Date(date))
await listing.load()
</script>

<template>
  <section class="mx-auto flex h-full min-h-0 w-full max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6">
    <header class="flex shrink-0 flex-wrap items-end justify-between gap-3 border-b border-default pb-4">
      <div class="min-w-0">
        <h1 class="flex items-center gap-3 text-xl font-semibold text-highlighted">
          <UIcon name="i-lucide-ticket" class="size-5 shrink-0 text-primary" />{{ title }}
        </h1>
        <p class="mt-1 text-sm text-muted">
          {{
            t(isAdmin ? 'features.serviceRequests.list.adminDescription' : 'features.serviceRequests.list.description')
          }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton v-if="can('create')" to="/requests/new" icon="i-lucide-plus" variant="outline" size="sm">{{
          t('features.serviceRequests.navigation.newRequest')
        }}</UButton>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          :aria-label="t('common.refresh')"
          :loading="listing.pending.value"
          @click="listing.refresh()"
        />
      </div>
    </header>
    <PortalListToolbar
      v-model:search="listing.search.value"
      :search-placeholder="t('features.serviceRequests.list.search')"
      :filters="filters"
      :filter-values="listing.filters"
      :sort-options="sortOptions"
      :sort-by="listing.sortBy.value"
      :sort-dir="listing.sortDir.value"
      @filter="listing.setFilter"
      @sort="listing.sortBy.value = $event"
      @toggle-direction="listing.toggleSortDir"
    />
    <ServiceRequestsPaginatedList
      class="min-h-0 flex-1"
      :pagination="listing.pagination.value"
      :pending="listing.pending.value"
      :loading-next="listing.loadingNextPage.value"
      :loading-previous="listing.loadingPreviousPage.value"
      :has-next="listing.hasNextPage.value"
      :has-previous="listing.hasPreviousPage.value"
      :error="Boolean(listing.error.value)"
      @next="listing.loadNext"
      @previous="listing.loadPrevious"
      @page="listing.goToPage"
    >
      <UAlert
        v-if="listing.error.value"
        color="error"
        variant="outline"
        icon="i-lucide-circle-alert"
        :title="t('features.serviceRequests.messages.fetchError')"
        class="mb-3"
      >
        <template #actions
          ><UButton color="error" variant="outline" @click="listing.refresh()">{{
            t('features.serviceRequests.dashboard.retry')
          }}</UButton></template
        >
      </UAlert>
      <UEmpty
        v-else-if="!listing.items.value.length"
        icon="i-lucide-ticket"
        :title="t(filtered ? 'features.serviceRequests.list.noMatches' : 'features.serviceRequests.list.emptyTitle')"
        :description="
          t(
            filtered
              ? 'features.serviceRequests.list.noMatchesDescription'
              : 'features.serviceRequests.list.emptyDescription'
          )
        "
      >
        <template v-if="!filtered && can('create')" #actions
          ><UButton to="/requests/new" icon="i-lucide-plus">{{
            t('features.serviceRequests.list.createFirst')
          }}</UButton></template
        >
      </UEmpty>
      <div class="grid gap-3">
        <UCard
          v-for="request in listing.items.value"
          :key="request.id"
          class="transition-colors hover:ring-1 hover:ring-primary/50"
          :ui="{ body: 'p-0 sm:p-0' }"
        >
          <NuxtLink
            :to="detailTo(request)"
            class="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <h2 class="break-words font-semibold text-highlighted">{{ request.title }}</h2>
                <UBadge :color="getStatusColor(request.status)" variant="subtle">{{
                  getStatusBadgeText(request.status)
                }}</UBadge>
                <UBadge :color="getPriorityColor(request.priority)" variant="subtle">{{
                  getPriorityBadgeText(request.priority)
                }}</UBadge>
              </div>
              <p class="mt-1 line-clamp-2 text-sm text-muted">{{ request.description }}</p>
              <div class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                <template v-if="request.clientName"
                  ><span>{{ request.clientName }}</span
                  ><span aria-hidden="true">·</span></template
                >
                <span>{{ formatDate(request.createdAt) }}</span>
                <template v-if="request.category"
                  ><span aria-hidden="true">·</span><span>{{ request.category }}</span></template
                >
              </div>
            </div>
            <UIcon name="i-lucide-chevron-right" class="size-5 shrink-0 text-muted group-hover:text-highlighted" />
          </NuxtLink>
        </UCard>
      </div>
    </ServiceRequestsPaginatedList>
  </section>
</template>
