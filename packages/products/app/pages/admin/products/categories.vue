<script setup lang="ts">
import type { ProductCategory, Page } from '../../../../shared/types'
import { categoryDeleteSchema } from '../../../../shared/validation'

const { t, locale } = useI18n(),
  api = useProducts(),
  route = useRoute(),
  router = useRouter(),
  toast = useToast()
const searchInput = ref(String(route.query.search || ''))
const sortBy = computed(() => (route.query.sortBy === 'code' ? 'code' : 'name'))
const sortDir = computed(() => (route.query.sortDir === 'desc' ? 'desc' : 'asc'))
const page = computed(() => Math.max(1, Number(route.query.page) || 1))
const items = ref<ProductCategory[]>([]),
  result = ref<Page<ProductCategory>>(),
  pending = ref(false),
  error = ref('')
const editing = ref<ProductCategory | null | undefined>(),
  deleting = ref<ProductCategory>(),
  eligible = ref<boolean>(),
  busy = ref(false)
const deleteState = reactive({ name: '' }),
  deleteSchema = useProductFormSchema(categoryDeleteSchema)
const listRoot = useTemplateRef('listRoot'),
  topBoundary = useTemplateRef('topBoundary'),
  bottomBoundary = useTemplateRef('bottomBoundary')
const name = (category: ProductCategory) => category.content[locale.value === 'nl' ? 'nl' : 'en'].name || category.name
const description = (category: ProductCategory) => category.content[locale.value === 'nl' ? 'nl' : 'en'].description
let timer: ReturnType<typeof setTimeout> | undefined,
  controller: AbortController | undefined,
  observer: IntersectionObserver | undefined
let signature = '',
  loaded = new Set<number>()
function filter(key: string, value: string) {
  return router.replace({ query: { ...route.query, [key]: value || undefined, page: undefined } })
}
watch(searchInput, (value) => {
  clearTimeout(timer)
  timer = setTimeout(() => filter('search', value.trim()), 300)
})
watch(
  () => route.query.search,
  (value) => {
    if (String(value || '') !== searchInput.value.trim()) {
      clearTimeout(timer)
      searchInput.value = String(value || '')
    }
  }
)
async function load(force = false) {
  controller?.abort()
  const active = new AbortController()
  controller = active
  pending.value = true
  error.value = ''
  const nextSignature = JSON.stringify({
    search: route.query.search,
    sortBy: sortBy.value,
    sortDir: sortDir.value,
    locale: locale.value
  })
  const same = !force && signature === nextSignature
  try {
    const response = await api.categoryPage(
      {
        search: route.query.search,
        sortBy: sortBy.value,
        sortDir: sortDir.value,
        page: page.value,
        locale: locale.value
      },
      active.signal
    )
    if (active.signal.aborted) {
      return
    }
    if (page.value > Math.max(1, response.pagination.totalPages)) {
      await router.replace({ query: { ...route.query, page: Math.max(1, response.pagination.totalPages) } })
      return
    }
    const scroll = listRoot.value?.closest('section'),
      height = scroll?.scrollHeight || 0
    const prepend = same && loaded.size > 0 && page.value < Math.min(...loaded)
    if (same && !loaded.has(page.value) && (loaded.has(page.value - 1) || loaded.has(page.value + 1))) {
      items.value = [
        ...new Map(
          (prepend ? [...response.items, ...items.value] : [...items.value, ...response.items]).map((item) => [
            item.id,
            item
          ])
        ).values()
      ]
    } else {
      items.value = response.items
      loaded = new Set()
    }
    result.value = response
    loaded.add(page.value)
    signature = nextSignature
    if (editing.value && !items.value.some((item) => item.id === editing.value?.id)) {
      editing.value = undefined
    }
    if (deleting.value && !items.value.some((item) => item.id === deleting.value?.id)) {
      deleting.value = undefined
    }
    await nextTick()
    if (prepend && scroll) {
      scroll.scrollTop += scroll.scrollHeight - height
    }
  } catch {
    if (!active.signal.aborted) {
      error.value = t('products.loadFailed')
    }
  } finally {
    if (!active.signal.aborted) {
      pending.value = false
    }
  }
}
watch(
  () => [route.fullPath, locale.value],
  () => {
    if (route.path === '/admin/products/categories') {
      void load()
    }
  },
  { immediate: true }
)
onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      if (pending.value || !loaded.size || !result.value) {
        return
      }
      const entry = entries.find((item) => item.isIntersecting)
      if (!entry) {
        return
      }
      const next = entry.target === topBoundary.value ? Math.min(...loaded) - 1 : Math.max(...loaded) + 1
      if (next > 0 && next <= result.value.pagination.totalPages && !loaded.has(next)) {
        void router.replace({ query: { ...route.query, page: next } })
      }
    },
    { root: listRoot.value?.closest('section'), rootMargin: '40px' }
  )
  if (topBoundary.value) {
    observer.observe(topBoundary.value)
  }
  if (bottomBoundary.value) {
    observer.observe(bottomBoundary.value)
  }
})
onBeforeUnmount(() => {
  clearTimeout(timer)
  controller?.abort()
  observer?.disconnect()
})
function openEditor(category?: ProductCategory) {
  deleting.value = undefined
  editing.value = category
    ? editing.value?.id === category.id
      ? undefined
      : category
    : editing.value === null
      ? undefined
      : null
}
async function saved() {
  editing.value = undefined
  toast.add({ title: t('products.saved'), color: 'success' })
  await load(true)
}
async function openDeletion(category: ProductCategory) {
  editing.value = undefined
  if (deleting.value?.id === category.id) {
    deleting.value = undefined
    return
  }
  deleting.value = category
  deleteState.name = ''
  eligible.value = undefined
  error.value = ''
  try {
    const result = await api.categoryDeletion(category.id)
    if (deleting.value?.id === category.id) {
      eligible.value = result.eligible
    }
  } catch {
    error.value = t('products.loadFailed')
  }
}
async function remove() {
  if (!deleting.value) {
    return
  }
  busy.value = true
  try {
    await api.deleteCategory(deleting.value.id, deleteState.name)
    deleting.value = undefined
    toast.add({ title: t('products.categoryDeleted'), color: 'success' })
    await load(true)
  } catch {
    error.value = t('products.categoryDeleteFailed')
  } finally {
    busy.value = false
  }
}
async function goToPage(value: number) {
  await router.replace({ query: { ...route.query, page: value } })
  listRoot.value?.closest('section')?.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <ProductsShell :title="t('products.categories')" :subtitle="t('products.categoriesIntro')" icon="i-lucide-tags">
    <template #actions
      ><UButton
        v-if="items.length || route.query.search"
        icon="i-lucide-plus"
        variant="outline"
        size="sm"
        @click="openEditor()"
        >{{ t('products.addCategory') }}</UButton
      ></template
    >
    <PortalListToolbar
      v-model:search="searchInput"
      :filters="[]"
      :filter-values="{}"
      :search-placeholder="t('products.search')"
      :sort-options="[
        { value: 'name', label: t('products.categoryName') },
        { value: 'code', label: t('products.categoryCode') }
      ]"
      :sort-by="sortBy"
      :sort-dir="sortDir"
      @sort="filter('sortBy', $event)"
      @toggle-direction="filter('sortDir', sortDir === 'asc' ? 'desc' : 'asc')"
    />
    <UAlert v-if="error" color="error" :title="error" />
    <div ref="listRoot" class="space-y-3">
      <div ref="topBoundary" class="h-px" />
      <ProductsCategoryForm v-if="editing === null" @saved="saved" @cancel="editing = undefined" />
      <ProductsEmptyState
        v-if="!items.length && !pending && editing === undefined"
        :filtered="!!route.query.search"
        icon="i-lucide-tags"
        :title="t(route.query.search ? 'products.noCategoryResults' : 'products.noCategories')"
        :description="t('products.categoriesIntro')"
        :action-label="t('products.createFirstCategory')"
        @create="openEditor()"
        @reset="filter('search', '')"
      />
      <template v-for="category in items" :key="category.id">
        <UCard
          role="button"
          tabindex="0"
          class="cursor-pointer transition-colors hover:ring-primary/50 focus-visible:outline-2 focus-visible:outline-primary"
          :class="{ 'ring-2 ring-primary': editing?.id === category.id }"
          @click="openEditor(category)"
          @keydown.enter="openEditor(category)"
          @keydown.space.prevent="openEditor(category)"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium">{{ name(category) }}</p>
              <p class="text-sm text-muted">
                {{ category.code }} · {{ t('products.categoryUsage', category.productCount) }}
              </p>
              <p v-if="description(category)" class="mt-1 line-clamp-2 text-sm text-muted">
                {{ description(category) }}
              </p>
            </div>
            <div class="flex shrink-0 gap-1" @keydown.stop>
              <UButton
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                :aria-label="t('products.editCategory', { name: name(category) })"
                :aria-expanded="editing?.id === category.id"
                @click.stop="openEditor(category)"
              />
              <UButton
                icon="i-lucide-trash-2"
                size="xs"
                color="error"
                variant="ghost"
                :aria-label="t('products.deleteCategory', { name: name(category) })"
                :aria-expanded="deleting?.id === category.id"
                @click.stop="openDeletion(category)"
              />
            </div>
          </div>
        </UCard>
        <ProductsCategoryForm
          v-if="editing?.id === category.id"
          :category="category"
          @saved="saved"
          @cancel="editing = undefined"
        />
        <UCard v-if="deleting?.id === category.id" class="ring-error" @keydown.esc.stop="deleting = undefined">
          <p v-if="eligible === undefined">{{ t('products.loading') }}</p>
          <UAlert v-else-if="!eligible" color="warning" :title="t('products.categoryInUse')" />
          <UForm v-else :state="deleteState" :schema="deleteSchema" novalidate class="space-y-3" @submit="remove">
            <p>{{ t('products.categoryDeleteConfirm', { name: name(category) }) }}</p>
            <UFormField name="name" :label="t('products.categoryTypeName')"
              ><UInput v-model="deleteState.name" class="w-full"
            /></UFormField>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" color="neutral" @click="deleting = undefined">{{
                t('products.cancel')
              }}</UButton
              ><UButton
                type="submit"
                color="error"
                icon="i-lucide-trash-2"
                :loading="busy"
                :disabled="deleteState.name !== name(category)"
                >{{ t('products.delete') }}</UButton
              >
            </div>
          </UForm>
          <UButton v-if="!eligible" class="mt-3" color="neutral" variant="outline" @click="deleting = undefined">{{
            t('products.cancel')
          }}</UButton>
        </UCard>
      </template>
      <div ref="bottomBoundary" class="h-px" />
      <p v-if="pending" role="status">{{ t('products.loading') }}</p>
    </div>
    <template #footer
      ><div class="flex items-center justify-between gap-3">
        <span class="text-sm text-muted">{{ t('products.results', result?.pagination.totalItems || 0) }}</span
        ><UPagination
          v-if="(result?.pagination.totalPages || 0) > 1"
          :page="page"
          :items-per-page="20"
          :total="result?.pagination.totalItems || 0"
          @update:page="goToPage"
        /></div
    ></template>
  </ProductsShell>
</template>
