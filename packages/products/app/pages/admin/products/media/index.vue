<script setup lang="ts">
import type { StoreMedia } from '../../../../../shared/media'

const mediaError = useMediaError()
const { t } = useI18n(),
  route = useRoute(),
  router = useRouter(),
  api = useStoreMedia()
const search = ref(String(route.query.search || ''))
const filters = computed(() => ({
  search: String(route.query.search || ''),
  category: String(route.query.category || ''),
  visibility: ['visible', 'hidden'].includes(String(route.query.visibility)) ? String(route.query.visibility) : 'all',
  sortBy: ['title', 'created'].includes(String(route.query.sortBy)) ? String(route.query.sortBy) : 'order',
  sortDir: route.query.sortDir === 'desc' ? ('desc' as const) : ('asc' as const)
}))
const categories = ref<string[]>([])
const resource = usePaginatedResource<StoreMedia, typeof filters.value>({
  fetchPage: async ({ filters: values, page, signal }) => {
    const result = await api.list({ ...values, page }, signal)
    categories.value = result.categories
    return result
  },
  getKey: (item) => item.id
})
const { pending, error, pagination, hasNextPage, hasPreviousPage } = resource
const items = computed(() => resource.items.value as unknown as StoreMedia[])
const scrollContainer = ref<HTMLElement | null>(null),
  top = ref<HTMLElement | null>(null),
  bottom = ref<HTMLElement | null>(null)
const cardSize = useCookie<'small' | 'medium' | 'large'>('products-media-card-size', { default: () => 'medium' })
const sizeOptions = computed(() =>
  ['small', 'medium', 'large'].map((value) => ({ value, label: t(`products.media.${value}`) }))
)
const reordering = ref(false),
  mutationError = ref('')
const manual = computed(
  () =>
    !filters.value.search &&
    !filters.value.category &&
    filters.value.visibility === 'all' &&
    filters.value.sortBy === 'order' &&
    filters.value.sortDir === 'asc'
)
const listContainer = ref<HTMLElement | null>(null),
  optimisticIds = ref<string[]>([])
const { draggedId, orderedIds, start, over, finish, cancel } = useMediaDragOrder({
  ids: computed(() => items.value.map((item) => item.id)),
  disabled: computed(() => !manual.value || reordering.value),
  container: listContainer,
  scrollContainer,
  selector: '[data-media-id]'
})
const displayedItems = computed(() => {
  const byId = new Map(items.value.map((item) => [item.id, item]))
  return (optimisticIds.value.length ? optimisticIds.value : orderedIds.value)
    .map((id) => byId.get(id))
    .filter((item): item is StoreMedia => !!item)
})
function startMediaDrag(event: DragEvent, item: StoreMedia) {
  if (pending.value) {
    event.preventDefault()
    return
  }
  start(event, item.id)
}
async function dropMedia() {
  const result = finish()
  if (!result) {
    return
  }
  const item = items.value.find((item) => item.id === result.id)
  if (!item) {
    return
  }
  optimisticIds.value = result.ids
  await move(item, result.beforeId, true)
  optimisticIds.value = []
}
const deleting = ref<StoreMedia>(),
  deleteOpen = ref(false),
  deletingBusy = ref(false)
const preview = ref<StoreMedia>(),
  previewOpen = ref(false)
const position = useState<{ id: string; offset: number; page: number } | null>(
  'products-media-library-position',
  () => null
)
let timer: ReturnType<typeof setTimeout> | undefined
let accumulated = false
async function query(key: string, value: string | undefined) {
  position.value = null
  await router.replace({ query: { ...route.query, [key]: value || undefined, page: undefined } })
}
watch(search, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    if (value.trim() !== filters.value.search) {
      void query('search', value.trim())
    }
  }, 300)
})
watch(
  () => filters.value.search,
  (value) => {
    search.value = value
  }
)
watch(
  () => route.fullPath,
  async () => {
    if (accumulated) {
      accumulated = false
      return
    }
    await resource.loadPage(filters.value, { page: Math.max(1, Number(route.query.page) || 1) })
  },
  { immediate: true }
)
async function boundary(previous = false) {
  if (pending.value || reordering.value) {
    return
  }
  const container = scrollContainer.value,
    height = container?.scrollHeight || 0
  await (previous ? resource.loadPreviousPage(filters.value) : resource.loadNextPage(filters.value))
  await nextTick()
  if (previous && container) {
    container.scrollTop += container.scrollHeight - height
  }
  if (!resource.error.value) {
    accumulated = true
    await router.replace({
      query: {
        ...route.query,
        page: resource.pagination.value.page === 1 ? undefined : String(resource.pagination.value.page)
      }
    })
    accumulated = false
  }
}
useAutoPagination({
  sentinel: top,
  scrollContainer,
  canLoadMore: hasPreviousPage,
  loading: pending,
  loadMore: () => boundary(true),
  rootMargin: '40px'
})
useAutoPagination({
  sentinel: bottom,
  scrollContainer,
  canLoadMore: hasNextPage,
  loading: pending,
  loadMore: () => boundary(),
  rootMargin: '240px'
})
function remember() {
  const container = scrollContainer.value
  if (!container) {
    return
  }
  const cards = [...container.querySelectorAll<HTMLElement>('[data-media-id]')]
  const index = cards.findIndex((card) => card.getBoundingClientRect().bottom > container.getBoundingClientRect().top)
  const card = cards[index]
  if (card) {
    position.value = {
      id: card.dataset.mediaId!,
      offset: card.getBoundingClientRect().top - container.getBoundingClientRect().top,
      page: resource.firstLoadedPage.value + Math.floor(index / 20)
    }
  }
}
function openEditor(item?: StoreMedia, batch = false) {
  remember()
  return router.push({
    path: item ? `/admin/products/media/${item.id}` : '/admin/products/media/upload',
    query: { ...route.query, ...(batch ? { batch: '1' } : {}) }
  })
}
onMounted(async () => {
  const saved = position.value
  if (!saved) {
    return
  }
  await resource.loadPage(filters.value, { page: saved.page })
  accumulated = true
  await router.replace({ query: { ...route.query, page: saved.page === 1 ? undefined : String(saved.page) } })
  accumulated = false
  await nextTick()
  const card = scrollContainer.value?.querySelector<HTMLElement>(`[data-media-id="${saved.id}"]`)
  if (card && scrollContainer.value) {
    scrollContainer.value.scrollTop +=
      card.getBoundingClientRect().top - scrollContainer.value.getBoundingClientRect().top - saved.offset
  }
})
onBeforeUnmount(() => clearTimeout(timer))
async function moveBy(item: StoreMedia, direction: -1 | 1) {
  if (!manual.value || pending.value || reordering.value) {
    return
  }
  let index = items.value.findIndex((row) => row.id === item.id)
  if (direction === -1 && index === 0 && hasPreviousPage.value) {
    await boundary(true)
  }
  if (direction === 1 && index + 2 >= items.value.length && hasNextPage.value) {
    await boundary()
  }
  index = items.value.findIndex((row) => row.id === item.id)
  const beforeId = direction === -1 ? items.value[index - 1]?.id : items.value[index + 2]?.id || null
  if (beforeId !== undefined) {
    await move(item, beforeId)
  }
}
async function move(item: StoreMedia, beforeId: string | null, allowPending = false) {
  if (!manual.value || reordering.value || (pending.value && !allowPending) || item.id === beforeId) {
    return
  }
  mutationError.value = ''
  reordering.value = true
  try {
    await api.reorder(item, beforeId)
    await resource.loadPage(filters.value, { page: Math.max(1, Number(route.query.page) || 1) })
  } catch (cause) {
    mutationError.value = mediaError(cause)
  } finally {
    reordering.value = false
    cancel()
  }
}
function openPreview(item: StoreMedia) {
  preview.value = item
  previewOpen.value = true
}
function openDelete(item: StoreMedia) {
  deleting.value = item
  deleteOpen.value = true
  mutationError.value = ''
}
async function remove() {
  if (!deleting.value || deletingBusy.value) {
    return
  }
  deletingBusy.value = true
  mutationError.value = ''
  try {
    await api.remove(deleting.value)
    deleteOpen.value = false
    await resource.loadPage(filters.value, { page: Math.max(1, Number(route.query.page) || 1) })
  } catch (cause) {
    mutationError.value = mediaError(cause)
  } finally {
    deletingBusy.value = false
  }
}
</script>

<template>
  <ProductsShell
    :title="t('products.media.library')"
    :subtitle="t('products.media.subtitle')"
    icon="i-lucide-images"
    constrained
    stack-actions
  >
    <template #actions>
      <UButton variant="outline" icon="i-lucide-plus" size="sm" @click="openEditor()">{{
        t('products.media.upload')
      }}</UButton>
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-images"
        size="sm"
        @click="openEditor(undefined, true)"
        >{{ t('products.media.batch') }}</UButton
      >
    </template>
    <template #controls>
      <PortalListToolbar
        v-model:search="search"
        :search-placeholder="t('products.media.search')"
        :filters="[
          {
            key: 'category',
            placeholder: t('products.media.categories'),
            items: [
              { label: t('products.media.allCategories'), value: '__all' },
              ...categories.map((value) => ({ label: value, value }))
            ]
          },
          {
            key: 'visibility',
            placeholder: t('products.media.visibility'),
            items: [
              { label: t('products.media.allVisibility'), value: 'all' },
              { label: t('products.media.visible'), value: 'visible' },
              { label: t('products.media.hidden'), value: 'hidden' }
            ]
          }
        ]"
        :filter-values="{ category: filters.category || '__all', visibility: filters.visibility }"
        :sort-options="[
          { label: t('products.media.manualOrder'), value: 'order' },
          { label: t('products.media.title'), value: 'title' },
          { label: t('products.media.newest'), value: 'created' }
        ]"
        :sort-by="filters.sortBy"
        :sort-dir="filters.sortDir"
        @filter="(key, value) => query(key, value === '__all' || value === 'all' ? undefined : value)"
        @sort="query('sortBy', $event)"
        @toggle-direction="query('sortDir', filters.sortDir === 'asc' ? 'desc' : 'asc')"
      />
      <div class="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
        <span>{{ manual ? t('products.media.reorderHelp') : t('products.media.filteredOrderHelp') }}</span>
        <USelect v-model="cardSize" :items="sizeOptions" :aria-label="t('products.media.cardSize')" class="w-32" />
      </div>
    </template>
    <div ref="scrollContainer" class="h-full min-h-0 overflow-y-auto">
      <UAlert
        v-if="error || mutationError"
        color="error"
        :description="mutationError || t('products.loadFailed')"
        class="mb-4"
      />
      <div ref="top" class="h-px" />
      <ProductsEmptyState
        v-if="!pending && !items.length"
        :filtered="!!filters.search || !!filters.category || filters.visibility !== 'all'"
        icon="i-lucide-images"
        :title="t('products.media.empty')"
        :description="t('products.media.emptyHelp')"
        :action-label="t('products.media.upload')"
        @create="openEditor()"
        @reset="router.replace({ query: {} })"
      />
      <div ref="listContainer" class="relative" @dragover="over" @drop.prevent.stop="dropMedia">
        <TransitionGroup
          tag="div"
          move-class="products-sort-move"
          class="products-media-grid grid gap-4 pb-4"
          :class="`products-media-grid-${cardSize}`"
        >
          <article
            v-for="item in displayedItems"
            :key="item.id"
            :data-media-id="item.id"
            class="overflow-hidden rounded-lg border border-default bg-default"
            :class="draggedId === item.id ? 'products-sort-slot' : ''"
            :draggable="manual && (!pending || !!draggedId) && !reordering"
            :tabindex="manual ? 0 : undefined"
            :aria-keyshortcuts="manual ? 'Alt+ArrowLeft Alt+ArrowRight' : undefined"
            @keydown.alt.left.prevent.stop="moveBy(item, -1)"
            @keydown.alt.right.prevent.stop="moveBy(item, 1)"
            @dragstart="startMediaDrag($event, item)"
            @dragend="cancel"
          >
            <button
              type="button"
              class="block aspect-4/3 w-full cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
              :aria-label="t('products.media.editNamed', { title: item.title })"
              @click="openEditor(item)"
            >
              <ProductsMediaImage :src="item.thumbnail?.url || item.image.url" :alt="item.alt" />
            </button>
            <div class="space-y-2 p-3">
              <div class="flex items-start justify-between gap-2">
                <h2 class="truncate font-semibold">{{ item.title }}</h2>
                <UBadge v-if="!item.visible" color="neutral" variant="soft">{{ t('products.media.hidden') }}</UBadge>
              </div>
              <p class="truncate text-sm text-muted">{{ item.alt }}</p>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="category in item.categories" :key="category" variant="subtle" color="neutral">{{
                  category
                }}</UBadge>
              </div>
              <div class="flex flex-col gap-2">
                <span class="whitespace-nowrap text-xs text-muted"
                  >{{ item.image.width }} × {{ item.image.height }}</span
                >
                <div class="products-media-card-actions -ml-1 flex min-w-0 flex-nowrap items-center justify-end gap-1">
                  <UButton
                    v-if="manual"
                    type="button"
                    class="mr-auto cursor-grab"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-grip-vertical"
                    :disabled="pending || reordering"
                    :aria-label="t('products.media.reorderNamed', { title: item.title })"
                    aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
                    @click.stop
                    @keydown.left.prevent.stop="moveBy(item, -1)"
                    @keydown.up.prevent.stop="moveBy(item, -1)"
                    @keydown.right.prevent.stop="moveBy(item, 1)"
                    @keydown.down.prevent.stop="moveBy(item, 1)"
                  />
                  <UButton
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-expand"
                    :aria-label="t('products.media.preview')"
                    @click="openPreview(item)"
                  />
                  <UButton
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-pencil"
                    :aria-label="t('products.media.edit')"
                    @click="openEditor(item)"
                  />
                  <UButton
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-trash-2"
                    :aria-label="t('products.media.delete')"
                    @click="openDelete(item)"
                  />
                </div>
              </div>
            </div>
          </article>
        </TransitionGroup>
      </div>
      <div v-if="pending" class="flex justify-center p-4" role="status">
        <UIcon name="i-lucide-loader-circle" class="animate-spin" /><span class="sr-only">{{
          t('products.media.loading')
        }}</span>
      </div>
      <div ref="bottom" class="h-px" />
    </div>
    <template #footer
      ><span>{{ t('products.media.count', { count: pagination.total }) }}</span
      ><UButton v-if="error" variant="link" @click="resource.loadPage(filters)">{{
        t('products.media.retry')
      }}</UButton></template
    >
  </ProductsShell>
  <UModal v-if="deleteOpen" v-model:open="deleteOpen" :title="t('products.media.delete')" :dismissible="!deletingBusy">
    <template #body
      ><p>{{ t('products.media.deleteHelp', { title: deleting?.title }) }}</p>
      <UAlert v-if="mutationError" class="mt-3" color="error" :description="mutationError"
    /></template>
    <template #footer
      ><UButton variant="outline" color="neutral" :disabled="deletingBusy" @click="deleteOpen = false">{{
        t('products.media.cancel')
      }}</UButton
      ><UButton color="error" icon="i-lucide-trash-2" :loading="deletingBusy" @click="remove">{{
        t('products.media.delete')
      }}</UButton></template
    >
  </UModal>
  <UModal
    v-if="previewOpen"
    v-model:open="previewOpen"
    :title="preview?.title"
    :description="preview?.alt"
    :ui="{ content: 'sm:max-w-5xl' }"
    ><template #body
      ><div class="h-[65vh]">
        <ProductsMediaImage v-if="preview" :src="preview.image.url" :alt="preview.alt" contain />
      </div>
      <p v-if="preview?.credit" class="mt-2 text-sm text-muted">{{ preview.credit }}</p></template
    ></UModal
  >
</template>
