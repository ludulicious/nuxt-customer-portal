<script setup lang="ts">
import { z } from 'zod'
import type { Product, Page } from '../../../../shared/types'
import { formatMoney } from '../../../../shared/money'

const { t, locale } = useI18n(),
  api = useProducts(),
  route = useRoute(),
  router = useRouter()
const result = ref<Page<Product>>(),
  items = ref<Product[]>([]),
  pending = ref(false),
  error = ref(''),
  editing = ref<Product>(),
  creating = ref(false),
  deleting = ref<Product>(),
  eligible = ref(false),
  deleteState = reactive({ name: '' })
const listRoot = useTemplateRef('listRoot'),
  topBoundary = useTemplateRef('topBoundary'),
  bottomBoundary = useTemplateRef('bottomBoundary')
let observer: IntersectionObserver | undefined
const deleteSchema = useProductFormSchema(z.object({ name: z.string().min(1) }))
const page = computed(() => Math.max(1, Number(route.query.page) || 1)),
  search = computed({ get: () => String(route.query.search || ''), set: (v) => filter('search', v) }),
  status = computed({
    get: () => String(route.query.status || 'all'),
    set: (v) => filter('status', v === 'all' ? '' : v)
  }),
  kind = computed({ get: () => String(route.query.type || 'all'), set: (v) => filter('type', v === 'all' ? '' : v) }),
  category = computed({ get: () => String(route.query.category || ''), set: (v) => filter('category', v) })
const sortBy = computed({ get: () => String(route.query.sortBy || 'updatedAt'), set: (v) => filter('sortBy', v) }),
  sortDir = computed({ get: () => String(route.query.sortDir || 'desc'), set: (v) => filter('sortDir', v) })
const options = (values: string[]) => values.map((value) => ({ value, label: t(`products.${value}`) }))
function filter(key: string, value: string) {
  router.replace({ query: { ...route.query, [key]: value || undefined, page: undefined } })
}
let controller: AbortController | undefined,
  previousSignature = '',
  loaded = new Set<number>()
async function load(force = false) {
  controller?.abort()
  const active = new AbortController()
  controller = active
  pending.value = true
  error.value = ''
  const signature = JSON.stringify({ ...route.query, page: undefined }),
    same = signature === previousSignature && !force
  try {
    const response = await api.list({ ...route.query, locale: locale.value, page: page.value }, active.signal)
    if (active.signal.aborted) {
      return
    }
    const scroll = listRoot.value?.closest('section')
    const height = scroll?.scrollHeight ?? 0
    const prepend = same && loaded.size > 0 && page.value < Math.min(...loaded)
    result.value = response
    if (same && !loaded.has(page.value) && (loaded.has(page.value - 1) || loaded.has(page.value + 1))) {
      items.value = Array.from(
        new Map(
          (prepend ? [...response.items, ...items.value] : [...items.value, ...response.items]).map((p) => [p.id, p])
        ).values()
      )
    } else {
      items.value = response.items
      loaded = new Set()
    }
    loaded.add(page.value)
    previousSignature = signature
    await nextTick()
    if (prepend && scroll) {
      scroll.scrollTop += scroll.scrollHeight - height
    }
    if (editing.value && !items.value.some((p) => p.id === editing.value?.id)) {
      editing.value = undefined
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
  () => route.fullPath,
  () => load(),
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
        router.replace({ query: { ...route.query, page: next } })
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
  controller?.abort()
  observer?.disconnect()
})
function startCreate() {
  creating.value = true
  editing.value = undefined
  deleting.value = undefined
}
function edit(product: Product) {
  editing.value = editing.value?.id === product.id ? undefined : product
  creating.value = false
  deleting.value = undefined
}
async function saved(product: Product) {
  creating.value = false
  editing.value = undefined
  await load(true)
  if (!product.fileIds.length && product.type === 'digital') {
    editing.value = product
  }
}
async function confirmDelete(product: Product) {
  if (deleting.value?.id === product.id) {
    deleting.value = undefined
    return
  }
  editing.value = undefined
  creating.value = false
  deleting.value = product
  deleteState.name = ''
  eligible.value = false
  try {
    eligible.value = (await api.deletion(product.id)).eligible
  } catch {
    error.value = t('products.loadFailed')
  }
}
async function remove() {
  if (!deleting.value) {
    return
  }
  try {
    await api.remove(deleting.value.id, deleteState.name)
    deleting.value = undefined
    await load(true)
  } catch {
    error.value = t('products.deleteFailed')
  }
}
</script>

<template>
  <ProductsShell :title="t('products.catalog')" :subtitle="t('products.catalogIntro')"
    ><template #actions
      ><UButton v-if="items.length" icon="i-lucide-plus" variant="outline" size="sm" @click="startCreate">{{
        t('products.new')
      }}</UButton></template
    ><UAlert v-if="error" color="error" :title="error" />
    <div class="flex flex-wrap gap-3">
      <UInput
        v-model="search"
        :placeholder="t('products.search')"
        :aria-label="t('products.search')"
        icon="i-lucide-search"
      /><USelect
        v-model="status"
        :items="options(['all', 'draft', 'published', 'archived'])"
        :aria-label="t('products.status')"
      /><USelect
        v-model="kind"
        :items="options(['all', 'digital', 'service'])"
        :aria-label="t('products.type')"
      /><UInput v-model="category" :placeholder="t('products.category')" :aria-label="t('products.category')" /><USelect
        v-model="sortBy"
        :items="options(['updatedAt', 'title'])"
        :aria-label="t('products.sort')"
      /><USelect v-model="sortDir" :items="options(['asc', 'desc'])" :aria-label="t('products.sortDirection')" />
    </div>
    <ProductsForm v-if="creating" @saved="saved" @cancel="creating = false" />
    <div v-if="!items.length && !pending && !creating" class="rounded-lg border p-10 text-center">
      <UIcon name="i-lucide-shopping-bag" class="size-10" />
      <h2 class="mt-3 text-xl">{{ t(search || status !== 'all' ? 'products.noResults' : 'products.empty') }}</h2>
      <p class="my-3 text-muted">{{ t('products.emptyHelp') }}</p>
      <UButton icon="i-lucide-plus" @click="creating = true">{{ t('products.createFirst') }}</UButton>
    </div>
    <div ref="listRoot">
      <div ref="topBoundary" class="h-px" aria-hidden="true" />
      <div class="grid gap-3">
        <template v-for="product in items" :key="product.id"
          ><article
            role="button"
            tabindex="0"
            class="flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-4"
            :aria-expanded="editing?.id === product.id"
            @click="edit(product)"
            @keydown.enter.prevent="edit(product)"
            @keydown.space.prevent="edit(product)"
          >
            <div>
              <h2 class="font-semibold">
                {{
                  product.content[locale === 'nl' ? 'nl' : 'en'].title ||
                  product.content.en.title ||
                  product.content.nl.title
                }}
              </h2>
              <p class="text-sm text-muted">
                {{ t(`products.${product.type}`) }} · {{ t(`products.${product.status}`) }} · {{ product.category }}
              </p>
              <p class="mt-2 text-sm">
                {{ product.prices.map((p) => formatMoney(p.amount, p.currency, locale)).join(' · ') }}
              </p>
            </div>
            <div class="flex gap-1" @click.stop @keydown.stop>
              <UButton
                icon="i-lucide-pencil"
                variant="ghost"
                :aria-label="t('products.edit')"
                :aria-expanded="editing?.id === product.id"
                @click="edit(product)"
              /><UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                :aria-label="t('products.delete')"
                :aria-expanded="deleting?.id === product.id"
                @click="confirmDelete(product)"
              />
            </div>
          </article>
          <ProductsForm
            v-if="editing?.id === product.id"
            :key="`edit-${product.id}`"
            :product="product"
            @saved="saved"
            @cancel="editing = undefined"
          /><UForm
            v-if="deleting?.id === product.id"
            :state="deleteState"
            :schema="deleteSchema"
            novalidate
            class="space-y-3 rounded-lg border p-4"
            @submit="remove"
            ><p>
              {{
                t(eligible ? 'products.deleteConfirm' : 'products.archiveInstead', {
                  name: product.content.en.title || product.content.nl.title
                })
              }}
            </p>
            <UFormField v-if="eligible" name="name" :label="t('products.typeName')"
              ><UInput v-model="deleteState.name"
            /></UFormField>
            <div class="flex justify-end gap-3">
              <UButton color="neutral" variant="outline" @click="deleting = undefined">{{
                t('products.cancel')
              }}</UButton
              ><UButton v-if="eligible" type="submit" color="error">{{ t('products.delete') }}</UButton>
            </div></UForm
          ></template
        >
      </div>
      <div ref="bottomBoundary" class="h-px" aria-hidden="true" />
    </div>
    <p v-if="pending" role="status">{{ t('products.loading') }}</p>
    <div v-if="result" class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted">{{ t('products.results', { count: result.pagination.totalItems }) }}</p>
      <UPagination
        :page="page"
        :items-per-page="20"
        :total="result.pagination.totalItems"
        @update:page="router.replace({ query: { ...route.query, page: $event } })"
      /></div
  ></ProductsShell>
</template>
