<script setup lang="ts">
import type { AppointmentListItem } from '../../composables/usePlanning'

const { appointmentRange } = usePlanningTimeDisplay()
const api = usePlanning(),
  { t } = useI18n(),
  route = useRoute(),
  scroller = ref<HTMLElement | null>(null),
  nextSentinel = ref<HTMLElement | null>(null),
  previousSentinel = ref<HTMLElement | null>(null),
  createOpen = ref(false),
  drawerOpen = ref(false),
  drawerAppointment = ref<AppointmentListItem>(),
  access = ref({ staff: false, canManage: false }),
  hosts = ref<Array<{ id: string; name: string }>>([]),
  searchDraft = ref(typeof route.query.search === 'string' ? route.query.search : '')
const { currentUser } = usePortalSession()
const userTimezone = computed(
  () => (currentUser.value as typeof currentUser.value & { timezone?: string })?.timezone || 'Europe/Amsterdam'
)
const displayTimezone = computed({
  get: () =>
    typeof route.query.timezone === 'string' && Intl.supportedValuesOf('timeZone').includes(route.query.timezone)
      ? route.query.timezone
      : userTimezone.value,
  set: (timezone: string) => {
    void navigateTo(
      { query: { ...route.query, timezone: timezone === userTimezone.value ? undefined : timezone } },
      { replace: true }
    )
  }
})
const filters = computed(() => ({
  search: typeof route.query.search === 'string' ? route.query.search : '',
  status: ['confirmed', 'cancelled'].includes(String(route.query.status)) ? String(route.query.status) : 'all',
  conflicts: route.query.conflicts === 'conflicts' ? 'conflicts' : 'all',
  host: typeof route.query.host === 'string' ? route.query.host : 'all',
  sortBy: route.query.sortBy === 'title' ? 'title' : 'start',
  sortOrder: route.query.sortOrder === 'asc' ? ('asc' as const) : ('desc' as const)
}))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const resource = usePaginatedResource<AppointmentListItem, typeof filters.value>({
  getKey: (item) => item.id,
  fetchPage: async ({ filters, page, signal }) => {
    const result = await api.appointments({ ...filters, page }, signal)
    access.value = result.access
    hosts.value = result.hosts
    return result
  }
})
const { items, pagination, pending, loadingPreviousPage, hasNextPage, hasPreviousPage, error } = resource
let skipQuery = ''
async function load() {
  await resource.loadPage(filters.value, { page: page.value })
}
await load()
watch(
  () => JSON.stringify(route.query),
  async (value) => {
    if (value === skipQuery) {
      skipQuery = ''
      return
    }
    createOpen.value = false
    drawerOpen.value = false
    drawerAppointment.value = undefined
    searchDraft.value = filters.value.search
    await load()
  }
)
let searchTimer: ReturnType<typeof setTimeout> | undefined
function updateSearch(value: string) {
  searchDraft.value = value
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void update({ search: value }), 250)
}
onBeforeUnmount(() => clearTimeout(searchTimer))
function updateFilter(key: string, value: string | undefined) {
  void update({ [key]: value || 'all' })
}
async function update(patch: Record<string, string | number>, target = 1) {
  const query: Record<string, string | number | undefined> = {
    timezone: typeof route.query.timezone === 'string' ? route.query.timezone : undefined,
    ...filters.value,
    ...patch,
    page: target
  }
  for (const key of Object.keys(query)) {
    if (
      query[key] === '' ||
      query[key] === 'all' ||
      (key === 'sortBy' && query[key] === 'start') ||
      (key === 'sortOrder' && query[key] === 'desc') ||
      (key === 'page' && query[key] === 1)
    ) {
      query[key] = undefined
    }
  }
  await navigateTo({ query })
}
async function boundary(direction: 'next' | 'previous') {
  if (pending.value) {
    return
  }
  const height = scroller.value?.scrollHeight || 0,
    top = scroller.value?.scrollTop || 0
  const result = direction === 'next' ? await resource.loadNextPage() : await resource.loadPreviousPage()
  if (!result) {
    return
  }
  await nextTick()
  if (direction === 'previous' && scroller.value) {
    scroller.value.scrollTop = top + scroller.value.scrollHeight - height
  }
  const query = { ...route.query, page: String(result.pagination.page) }
  skipQuery = JSON.stringify(query)
  await navigateTo({ query }, { replace: true })
}
useAutoPagination({
  sentinel: nextSentinel,
  scrollContainer: scroller,
  canLoadMore: hasNextPage,
  loading: pending,
  loadMore: () => boundary('next')
})
useAutoPagination({
  sentinel: previousSentinel,
  scrollContainer: scroller,
  canLoadMore: hasPreviousPage,
  loading: pending,
  loadMore: () => boundary('previous'),
  rootMargin: '120px 0px 0px 0px'
})
function toggleCreate() {
  createOpen.value = !createOpen.value
}
function manage(item: AppointmentListItem) {
  drawerAppointment.value = item
  drawerOpen.value = true
}
function visibleTimezone(timezone: string | undefined) {
  return timezone || userTimezone.value
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto">
      <UContainer class="space-y-5 py-8">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-start gap-3">
            <UIcon name="i-lucide-calendar-check" class="mt-1 size-6 text-primary" />
            <div>
              <h1 class="text-2xl font-semibold">{{ t('planning.appointments') }}</h1>
              <p class="mt-1 text-sm text-muted">
                {{ t(access.staff ? 'planning.staffAppointmentsSubtitle' : 'planning.customerAppointmentsSubtitle') }}
              </p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <PlanningTimezoneSelect v-model="displayTimezone" :user-timezone="userTimezone" />
            <UButton
              v-if="access.canManage && pagination.total"
              icon="i-lucide-plus"
              variant="outline"
              @click="toggleCreate"
              >{{ t('planning.newAppointment') }}</UButton
            >
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              size="sm"
              :loading="pending"
              :aria-label="t('common.refresh')"
              @click="load"
            />
          </div>
        </header>
        <PortalListToolbar
          :search="searchDraft"
          :search-placeholder="t('planning.searchAppointments')"
          :filters="[
            {
              key: 'status',
              placeholder: t('planning.status'),
              items: [
                { value: 'all', label: t('planning.allStatuses') },
                { value: 'confirmed', label: t('planning.confirmed') },
                { value: 'cancelled', label: t('planning.cancelled') }
              ]
            },
            ...(access.staff
              ? [
                  {
                    key: 'host',
                    placeholder: t('planning.host'),
                    items: [
                      { value: 'all', label: t('planning.allHosts') },
                      ...hosts.map((host) => ({ value: host.id, label: host.name }))
                    ]
                  },
                  {
                    key: 'conflicts',
                    placeholder: t('planning.conflict'),
                    items: [
                      { value: 'all', label: t('planning.allAppointments') },
                      { value: 'conflicts', label: t('planning.conflictsOnly') }
                    ]
                  }
                ]
              : [])
          ]"
          :filter-values="{ status: filters.status, host: filters.host, conflicts: filters.conflicts }"
          :sort-options="[
            { value: 'start', label: t('planning.sortDate') },
            { value: 'title', label: t('planning.sortTitle') }
          ]"
          :sort-by="filters.sortBy"
          :sort-dir="filters.sortOrder"
          @update:search="updateSearch"
          @filter="updateFilter"
          @sort="update({ sortBy: $event })"
          @toggle-direction="update({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' })"
        />
        <UAlert v-if="error" color="error" variant="outline" :title="t('planning.loadError')" />
        <PlanningAppointmentCreateForm v-if="createOpen" @cancel="createOpen = false" />
        <div v-if="hasPreviousPage" ref="previousSentinel" class="h-px" aria-hidden="true" />
        <p v-if="loadingPreviousPage" role="status">{{ t('planning.loading') }}</p>
        <div v-if="!pending && !items.length" class="rounded-lg border border-default px-6 py-10 text-center">
          <UIcon name="i-lucide-calendar-days" class="size-10 text-dimmed" />
          <h2 class="mt-3 font-semibold">
            {{
              t(
                filters.search || filters.status !== 'all' || filters.host !== 'all' || filters.conflicts !== 'all'
                  ? 'planning.noMatchingAppointments'
                  : 'planning.noAppointments'
              )
            }}
          </h2>
          <p class="mt-2 text-sm text-muted">{{ t('planning.emptyAppointmentsDescription') }}</p>
          <UButton
            v-if="access.canManage && !createOpen"
            icon="i-lucide-plus"
            class="mt-5"
            @click="createOpen = true"
            >{{ t('planning.newAppointment') }}</UButton
          >
        </div>
        <div class="flex flex-col gap-3">
          <UCard v-for="item in items" :key="item.id">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="font-semibold">{{ item.title }}</h2>
                  <UBadge :color="item.status === 'confirmed' ? 'success' : 'neutral'" variant="subtle">{{
                    t(`planning.${item.status}`)
                  }}</UBadge>
                  <UBadge v-if="item.conflict" color="error" variant="subtle">{{ t('planning.conflict') }}</UBadge>
                </div>
                <div class="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <p class="flex min-w-0 items-start gap-2">
                    <UIcon name="i-lucide-calendar-clock" class="mt-0.5 size-4 shrink-0 text-muted" />
                    <span>
                      <span class="font-medium text-highlighted">{{
                        appointmentRange(item.start, item.end, displayTimezone)
                      }}</span>
                      <span class="block text-muted">{{ displayTimezone }}</span>
                    </span>
                  </p>
                  <p class="flex min-w-0 items-center gap-2">
                    <UIcon name="i-lucide-user-round" class="size-4 shrink-0 text-muted" />
                    <span class="min-w-0">
                      <span class="block truncate">{{ item.providerName || t('planning.unknownHost') }}</span>
                      <span v-if="access.staff && item.providerEmail" class="block truncate text-muted">{{
                        item.providerEmail
                      }}</span>
                    </span>
                  </p>
                  <p v-if="access.staff" class="flex min-w-0 items-center gap-2">
                    <UIcon name="i-lucide-contact-round" class="size-4 shrink-0 text-muted" />
                    <span class="truncate">{{ item.customerName || item.email }}</span>
                  </p>
                  <p v-if="access.staff" class="flex min-w-0 items-center gap-2">
                    <UIcon name="i-lucide-mail" class="size-4 shrink-0 text-muted" />
                    <span class="truncate">{{ item.email }}</span>
                  </p>
                  <p v-if="access.staff && item.country" class="flex min-w-0 items-center gap-2">
                    <UIcon name="i-lucide-map-pin" class="size-4 shrink-0 text-muted" />
                    <span class="truncate">{{ item.country }}</span>
                  </p>
                  <div v-if="item.meetingProvider === 'zoom'" class="flex min-w-0 items-center gap-2">
                    <UButton
                      v-if="item.status === 'confirmed' && item.meetingUrl"
                      :to="item.meetingUrl"
                      target="_blank"
                      icon="i-lucide-video"
                      size="xs"
                      variant="outline"
                    >
                      {{ t('planning.joinZoom') }}
                    </UButton>
                    <template v-else>
                      <UIcon name="i-lucide-video" class="size-4 shrink-0 text-primary" />
                      <span>
                        <span class="font-medium text-highlighted">{{ t('planning.zoomMeeting') }}</span>
                        <span v-if="item.status === 'confirmed'" class="block text-muted">{{
                          t('planning.zoomLinkPending')
                        }}</span>
                      </span>
                    </template>
                  </div>
                  <p
                    v-if="visibleTimezone(item.providerTimezone) !== displayTimezone"
                    class="flex min-w-0 items-start gap-2"
                  >
                    <UIcon name="i-lucide-clock-3" class="mt-0.5 size-4 shrink-0 text-muted" />
                    <span>
                      <span class="text-muted">{{ t('planning.hostTimezone') }}</span>
                      <span class="block">{{
                        appointmentRange(item.start, item.end, visibleTimezone(item.providerTimezone))
                      }}</span>
                      <span class="block text-muted">{{ visibleTimezone(item.providerTimezone) }}</span>
                    </span>
                  </p>
                  <p
                    v-if="visibleTimezone(item.customerTimezone) !== displayTimezone"
                    class="flex min-w-0 items-start gap-2"
                  >
                    <UIcon name="i-lucide-globe-2" class="mt-0.5 size-4 shrink-0 text-muted" />
                    <span>
                      <span class="text-muted">{{ t('planning.customerTimezone') }}</span>
                      <span class="block">{{
                        appointmentRange(item.start, item.end, visibleTimezone(item.customerTimezone))
                      }}</span>
                      <span class="block text-muted">{{ visibleTimezone(item.customerTimezone) }}</span>
                    </span>
                  </p>
                </div>
              </div>
              <div class="flex flex-wrap items-center justify-end gap-2">
                <UButton
                  :icon="access.canManage ? 'i-lucide-settings-2' : 'i-lucide-eye'"
                  color="neutral"
                  variant="outline"
                  @click="manage(item)"
                >
                  {{ t(access.canManage ? 'planning.manageAppointment' : 'planning.viewAppointment') }}
                </UButton>
              </div>
            </div>
            <p v-if="item.effectsError && access.staff" class="mt-2 break-words text-sm text-error">
              {{ t('planning.syncError') }}
            </p>
          </UCard>
        </div>
        <p v-if="pending" role="status">{{ t('planning.loading') }}</p>
        <div v-if="hasNextPage" ref="nextSentinel" class="h-px" aria-hidden="true" />
      </UContainer>
    </div>
    <footer
      class="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-default px-6 py-3 text-sm text-muted"
    >
      <span>{{ t('planning.appointmentCount', { count: pagination.total }) }}</span
      ><UPagination
        v-if="pagination.pageCount > 1"
        :page="pagination.page"
        :total="pagination.total"
        :items-per-page="20"
        :disabled="pending"
        :aria-label="t('planning.pagination')"
        @update:page="update({}, $event)"
      />
    </footer>
    <PlanningAppointmentDrawer
      v-if="drawerOpen && drawerAppointment"
      v-model:open="drawerOpen"
      :item="drawerAppointment"
      :timezone="displayTimezone"
      :staff="access.staff"
      @changed="load"
    />
  </div>
</template>
