<script setup lang="ts">
import type { AppointmentListItem } from '../../composables/usePlanning'

const api = usePlanning(),
  { t, locale } = useI18n(),
  route = useRoute(),
  scroller = ref<HTMLElement | null>(null),
  nextSentinel = ref<HTMLElement | null>(null),
  previousSentinel = ref<HTMLElement | null>(null),
  selected = ref(''),
  createOpen = ref(false),
  access = ref({ staff: false, canManage: false })
const filters = computed(() => ({
  search: typeof route.query.search === 'string' ? route.query.search : '',
  status: ['confirmed', 'cancelled'].includes(String(route.query.status)) ? String(route.query.status) : 'all',
  conflicts: route.query.conflicts === 'conflicts' ? 'conflicts' : 'all',
  sortBy: route.query.sortBy === 'title' ? 'title' : 'start',
  sortOrder: route.query.sortOrder === 'asc' ? 'asc' : 'desc'
}))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const resource = usePaginatedResource<AppointmentListItem, typeof filters.value>({
  getKey: (item) => item.id,
  fetchPage: async ({ filters, page, signal }) => {
    const result = await api.appointments({ ...filters, page }, signal)
    access.value = result.access
    return result
  }
})
const { items, pagination, pending, loadingPreviousPage, hasNextPage, hasPreviousPage, error } = resource
let skipQuery = ''
async function load() {
  await resource.loadPage(filters.value, { page: page.value })
  if (selected.value && !items.value.some((i) => i.id === selected.value)) {
    selected.value = ''
  }
}
onMounted(load)
watch(
  () => JSON.stringify(route.query),
  async (value) => {
    if (value === skipQuery) {
      skipQuery = ''
      return
    }
    selected.value = ''
    createOpen.value = false
    await load()
  }
)
async function update(patch: Record<string, string | number>, target = 1) {
  const query: Record<string, string | number | undefined> = { ...filters.value, ...patch, page: target }
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
async function toggle(id: string) {
  createOpen.value = false
  selected.value = selected.value === id ? '' : id
  await nextTick()
  const editor = scroller.value?.querySelector<HTMLElement>('[data-appointment-editor]')
  editor?.scrollIntoView({
    behavior: 'smooth',
    block: editor.getBoundingClientRect().height < window.innerHeight - 100 ? 'center' : 'start'
  })
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
          <UButton
            v-if="access.canManage && pagination.total"
            icon="i-lucide-plus"
            variant="outline"
            @click="toggleCreate"
            >{{ t('planning.newAppointment') }}</UButton
          >
        </header>
        <div class="flex flex-wrap gap-3">
          <UInput
            :model-value="filters.search"
            icon="i-lucide-search"
            :placeholder="t('planning.searchAppointments')"
            :aria-label="t('planning.searchAppointments')"
            class="min-w-0 flex-1"
            @update:model-value="update({ search: String($event) })"
          />
          <USelect
            :model-value="filters.status"
            :items="[
              { value: 'all', label: t('planning.allStatuses') },
              { value: 'confirmed', label: t('planning.confirmed') },
              { value: 'cancelled', label: t('planning.cancelled') }
            ]"
            :aria-label="t('planning.status')"
            @update:model-value="update({ status: String($event) })"
          />
          <USelect
            v-if="access.staff"
            :model-value="filters.conflicts"
            :items="[
              { value: 'all', label: t('planning.allAppointments') },
              { value: 'conflicts', label: t('planning.conflict') }
            ]"
            :aria-label="t('planning.conflict')"
            @update:model-value="update({ conflicts: String($event) })"
          />
          <USelect
            :model-value="filters.sortBy"
            :items="[
              { value: 'start', label: t('planning.sortDate') },
              { value: 'title', label: t('planning.sortTitle') }
            ]"
            :aria-label="t('planning.sort')"
            @update:model-value="update({ sortBy: String($event) })"
          />
          <UButton
            color="neutral"
            variant="outline"
            :icon="filters.sortOrder === 'desc' ? 'i-lucide-arrow-down-wide-narrow' : 'i-lucide-arrow-up-wide-narrow'"
            :aria-label="t(filters.sortOrder === 'desc' ? 'planning.sortAscending' : 'planning.sortDescending')"
            @click="update({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc' })"
          />
        </div>
        <UAlert v-if="error" color="error" variant="outline" :title="t('planning.loadError')" />
        <PlanningAppointmentCreateForm v-if="createOpen" @cancel="createOpen = false" />
        <div v-if="hasPreviousPage" ref="previousSentinel" class="h-px" aria-hidden="true" />
        <p v-if="loadingPreviousPage" role="status">{{ t('planning.loading') }}</p>
        <div v-if="!pending && !items.length" class="rounded-lg border border-default px-6 py-10 text-center">
          <UIcon name="i-lucide-calendar-days" class="size-10 text-dimmed" />
          <h2 class="mt-3 font-semibold">
            {{
              t(
                filters.search || filters.status !== 'all' || filters.conflicts !== 'all'
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
          <template v-for="item in items" :key="item.id">
            <UCard
              role="button"
              tabindex="0"
              :aria-expanded="selected === item.id"
              @click="toggle(item.id)"
              @keydown.enter.prevent="toggle(item.id)"
              @keydown.space.prevent="toggle(item.id)"
              ><div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <h2 class="font-semibold">{{ item.title }}</h2>
                  <p class="mt-1 text-sm text-muted">
                    {{
                      new Intl.DateTimeFormat(locale, {
                        dateStyle: 'long',
                        timeStyle: 'short',
                        timeZone: item.customerTimezone || 'Europe/Amsterdam'
                      }).format(new Date(item.start))
                    }}
                    · {{ item.providerName }}
                  </p>
                  <p v-if="access.staff" class="mt-1 break-words text-sm text-muted">{{ item.email }}</p>
                </div>
                <div class="flex items-center gap-2" @click.stop @keydown.stop>
                  <UBadge :color="item.status === 'confirmed' ? 'success' : 'neutral'" variant="subtle">{{
                    t(`planning.${item.status}`)
                  }}</UBadge
                  ><UButton
                    :icon="access.canManage ? 'i-lucide-pencil' : 'i-lucide-eye'"
                    color="neutral"
                    variant="ghost"
                    :aria-label="t(access.canManage ? 'planning.editAppointment' : 'planning.viewAppointment')"
                    :aria-expanded="selected === item.id"
                    @click="toggle(item.id)"
                  />
                </div>
              </div>
              <UBadge v-if="item.conflict" color="error" variant="subtle" class="mt-3">{{
                t('planning.conflict')
              }}</UBadge>
              <p v-if="item.effectsError && access.staff" class="mt-2 break-words text-sm text-error">
                {{ t('planning.syncError') }}
              </p></UCard
            >
            <UCard
              v-if="selected === item.id"
              data-appointment-editor
              class="scroll-mt-24"
              @keydown.esc.stop="selected = ''"
              ><template #header
                ><div class="flex items-center justify-between">
                  <h2 class="font-semibold">
                    {{ t(access.canManage ? 'planning.editAppointment' : 'planning.viewAppointment') }}
                  </h2>
                  <UButton
                    icon="i-lucide-x"
                    color="neutral"
                    variant="ghost"
                    :aria-label="t('planning.close')"
                    @click="selected = ''"
                  /></div></template
              ><PlanningAppointmentDetails :id="item.id" @changed="load"
            /></UCard>
          </template>
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
  </div>
</template>
