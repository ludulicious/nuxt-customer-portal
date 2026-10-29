<script setup lang="ts">
import { productMediaSchema } from '../../shared/product-media'
import type { StoreMedia } from '../../shared/media'
import type { Asset } from '../../shared/types'

const props = defineProps<{ productId: string; excludedMediaIds: string[] }>()
const emit = defineEmits<{ selected: [asset: Asset]; cancel: [] }>()
const { t } = useI18n(),
  api = useStoreMedia(),
  products = useProducts()
const state = reactive({ mediaId: '' })
const schema = useProductFormSchema(productMediaSchema.pick({ mediaId: true }))

const selected = ref<StoreMedia>(),
  saving = ref(false),
  mutationError = ref('')
const filters = reactive({
  search: '',
  category: '',
  visibility: 'visible',
  sortBy: 'title',
  sortDir: 'asc' as 'asc' | 'desc'
})
const categories = ref<string[]>([])
const resource = usePaginatedResource<StoreMedia, typeof filters>({
  fetchPage: async ({ filters: values, page, signal }) => {
    const response = await api.list({ ...values, page }, signal)
    categories.value = response.categories
    return response
  },
  getKey: (item) => item.id
})
const { pending, error, pagination, hasNextPage } = resource
const items = computed(() => resource.items.value as unknown as StoreMedia[])
const scrollContainer = ref<HTMLElement | null>(null),
  bottom = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => JSON.stringify(filters),
  () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      void resource.loadPage({ ...filters })
    }, 250)
  },
  { immediate: true }
)
onBeforeUnmount(() => clearTimeout(timer))
useAutoPagination({
  sentinel: bottom,
  scrollContainer,
  canLoadMore: hasNextPage,
  loading: pending,
  loadMore: () => resource.loadNextPage({ ...filters }),
  rootMargin: '120px'
})
function choose(media: StoreMedia) {
  selected.value = media
  state.mediaId = media.id
  mutationError.value = ''
}
async function submit() {
  saving.value = true
  mutationError.value = ''
  try {
    emit('selected', await products.linkMedia(props.productId, state))
  } catch {
    mutationError.value = t('products.productMedia.unavailable')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UForm :schema="schema" :state="state" novalidate class="space-y-4" @submit="submit">
    <p class="text-sm text-muted">{{ t('products.productMedia.pickerHelp') }}</p>
    <PortalListToolbar
      :search="filters.search"
      :search-placeholder="t('products.media.search')"
      :filters="[
        {
          key: 'category',
          placeholder: t('products.media.categories'),
          items: [
            { label: t('products.media.allCategories'), value: '__all' },
            ...categories.map((value) => ({ label: value, value }))
          ]
        }
      ]"
      :filter-values="{ category: filters.category || '__all' }"
      :sort-options="[
        { label: t('products.media.title'), value: 'title' },
        { label: t('products.media.newest'), value: 'created' }
      ]"
      :sort-by="filters.sortBy"
      :sort-dir="filters.sortDir"
      @update:search="filters.search = $event"
      @filter="(_key, value) => (filters.category = value === '__all' ? '' : value || '')"
      @sort="filters.sortBy = $event"
      @toggle-direction="filters.sortDir = filters.sortDir === 'asc' ? 'desc' : 'asc'"
    />
    <UAlert v-if="error || mutationError" color="error" :description="mutationError || t('products.loadFailed')" />
    <UFormField name="mediaId">
      <div ref="scrollContainer" class="max-h-[40vh] min-h-32 overflow-y-auto p-1">
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            v-for="item in items"
            :key="item.id"
            type="button"
            :aria-label="t('products.productMedia.select', { title: item.title })"
            :aria-pressed="state.mediaId === item.id"
            :disabled="saving || excludedMediaIds.includes(item.id)"
            class="overflow-hidden rounded-lg border text-left focus-visible:outline-2 focus-visible:outline-primary"
            :class="state.mediaId === item.id ? 'border-primary ring-2 ring-primary/30' : 'border-default'"
            @click="choose(item)"
          >
            <div class="aspect-[4/3]">
              <ProductsMediaImage :src="item.thumbnail?.url || item.image.url" :alt="item.alt" />
            </div>
            <p class="truncate p-2 text-sm">{{ item.title }}</p>
          </button>
        </div>
        <p v-if="!pending && !items.length" class="py-8 text-center text-muted">
          {{ t('products.productMedia.empty') }}
        </p>
        <p v-if="pending" role="status" class="p-4 text-center text-muted">{{ t('products.media.loading') }}</p>
        <div ref="bottom" class="h-px" />
      </div>
    </UFormField>
    <div class="flex items-center justify-between gap-3 text-sm text-muted">
      <span>{{ t('products.media.count', { count: pagination.total }) }}</span>
      <UButton
        v-if="hasNextPage || error"
        type="button"
        variant="link"
        :loading="pending"
        @click="error ? resource.loadPage({ ...filters }) : resource.loadNextPage({ ...filters })"
        >{{ t('products.productMedia.loadMore') }}</UButton
      >
      <UButton
        to="/admin/products/media"
        target="_blank"
        type="button"
        color="neutral"
        variant="link"
        trailing-icon="i-lucide-external-link"
        >{{ t('products.productMedia.manage') }}</UButton
      >
    </div>
    <div class="flex justify-end gap-3">
      <UButton type="button" color="neutral" variant="outline" :disabled="saving" @click="emit('cancel')">{{
        t('products.cancel')
      }}</UButton>
      <UButton type="submit" :disabled="!selected || saving" :loading="saving">{{
        t('products.productMedia.use')
      }}</UButton>
    </div>
  </UForm>
</template>
