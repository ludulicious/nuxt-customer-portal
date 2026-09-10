<script setup lang="ts">
import type { z } from 'zod'
import type { Product, Asset, ProductCategory } from '../../shared/types'
import { emptyProduct, productSchema, productCurrencies } from '../../shared/validation'
import { currencyScale } from '../../shared/money'

const props = defineProps<{ product?: Product }>(),
  emit = defineEmits<{ saved: [product: Product]; cancel: [] }>()
const { t } = useI18n(),
  api = useProducts(),
  schema = useProductFormSchema(productSchema)
const state = reactive<z.infer<typeof productSchema>>(
  props.product ? structuredClone(toRaw(props.product)) : emptyProduct()
)
const busy = ref(false),
  error = ref(''),
  assets = ref<Asset[]>([]),
  form = useTemplateRef('form'),
  root = useTemplateRef('root')
const categories = ref<ProductCategory[]>([])
const categoriesOpen = ref(false)
const categoryOptions = computed(() => [
  { label: t('products.noCategory'), value: 'none' },
  ...categories.value.map((category) => ({ label: category.name, value: `category:${category.name}` }))
])
const selectedCategory = computed({
  get: () => (state.category ? `category:${state.category}` : 'none'),
  set: (value: string) => {
    state.category = value === 'none' ? '' : value.slice('category:'.length)
  }
})
async function loadCategories() {
  categories.value = await api.categories()
}
function categorySaved(category: { name: string }) {
  state.category = category.name
}
const selectedLanguage = ref<'en' | 'nl'>('en')
const defaultLanguage = ref<'en' | 'nl'>('en')
const languageReady = ref(false)
const languageOptions = computed(() =>
  ([defaultLanguage.value, defaultLanguage.value === 'en' ? 'nl' : 'en'] as const).map((value) => ({
    value,
    disabled: !languageReady.value,
    label: value === 'en' ? '🇺🇸 English' : '🇳🇱 Nederlands'
  }))
)
async function showInvalidLanguage(event: { errors: Array<{ name?: string }> }) {
  const field = event.errors.find(({ name }) => /^(content|nextSteps)\.(en|nl)(\.|$)/.test(name || ''))
  const language = field?.name?.split('.')[1]
  if (language === 'en' || language === 'nl') {
    selectedLanguage.value = language
  }
  await nextTick()
  const invalid = root.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
  invalid?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  invalid?.focus({ preventScroll: true })
}
const currencyOptions: string[] = [...productCurrencies]
const types = computed(() => ['digital', 'service'].map((value) => ({ value, label: t(`products.${value}`) })))
const statuses = computed(() =>
  ['draft', 'published', 'archived'].map((value) => ({ value, label: t(`products.${value}`) }))
)
const taxOptions = computed(() => ['inclusive', 'exclusive'].map((value) => ({ value, label: t(`products.${value}`) })))
onMounted(async () => {
  await loadCategories().catch(() => {
    error.value = t('products.loadFailed')
  })
  try {
    const settings = await api.settings()
    defaultLanguage.value = settings.defaultLocale
    selectedLanguage.value = settings.defaultLocale
  } catch {
    error.value = t('products.languageLoadFailed')
  } finally {
    languageReady.value = true
  }
  if (props.product) {
    assets.value = await api.assets(props.product.id)
  }
  await nextTick()
  root.value?.scrollIntoView({
    behavior: 'smooth',
    block: root.value.offsetHeight < window.innerHeight - 120 ? 'center' : 'start'
  })
  root.value?.querySelector('input')?.focus({ preventScroll: true })
})
async function save() {
  busy.value = true
  error.value = ''
  try {
    emit('saved', await api.save(state, props.product?.id))
  } catch (e) {
    error.value = t('products.saveFailed')
    const field = (e as { data?: { data?: { field?: string } } }).data?.data?.field
    if (field) {
      form.value?.setErrors([{ name: field, message: t('products.conflict') }])
    }
    await nextTick()
    root.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } finally {
    busy.value = false
  }
}
async function upload(event: Event, visibility: 'public' | 'private') {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !props.product) {
    return
  }
  busy.value = true
  error.value = ''
  try {
    const id = await api.upload(props.product.id, file, visibility)
    ;(visibility === 'public' ? state.imageIds : state.fileIds).push(id)
    assets.value = await api.assets(props.product.id)
  } catch {
    error.value = t('products.uploadFailed')
  } finally {
    busy.value = false
    ;(event.target as HTMLInputElement).value = ''
  }
}
function move(ids: string[], index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= ids.length) {
    return
  }
  const [id] = ids.splice(index, 1)
  ids.splice(target, 0, id!)
}
</script>

<template>
  <div ref="root" class="scroll-mt-24" @keydown.esc.stop="emit('cancel')">
    <UForm
      ref="form"
      :state="state"
      :schema="schema"
      novalidate
      class="space-y-5"
      @submit="save"
      @error="showInvalidLanguage"
    >
      <UAlert v-if="error" color="error" :title="error" />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField name="slug" :label="t('products.slug')"><UInput v-model="state.slug" class="w-full" /></UFormField
        ><UFormField name="category" :label="t('products.category')"
          ><div class="flex gap-2">
            <USelectMenu
              v-model="selectedCategory"
              :items="categoryOptions"
              value-key="value"
              :placeholder="t('products.selectCategory')"
              class="min-w-0 flex-1"
            />
            <UButton
              icon="i-lucide-plus"
              variant="outline"
              :aria-label="t('products.manageCategories')"
              @click="categoriesOpen = true"
            /></div></UFormField
        ><UFormField name="type" :label="t('products.type')"
          ><USelect v-model="state.type" :items="types" class="w-full" /></UFormField
        ><UFormField name="status" :label="t('products.status')"
          ><USelect v-model="state.status" :items="statuses" class="w-full"
        /></UFormField>
      </div>
      <UTabs
        v-model="selectedLanguage"
        :items="languageOptions"
        variant="link"
        :ui="{ list: 'justify-start', trigger: 'grow-0' }"
      >
        <template #content="{ item }">
          <div class="space-y-3 pt-4">
            <UFormField :name="`content.${item.value}.title`" :label="t('products.name')"
              ><UInput v-model="state.content[item.value].title" class="w-full" /></UFormField
            ><UFormField :name="`content.${item.value}.summary`" :label="t('products.summary')"
              ><UTextarea v-model="state.content[item.value].summary" class="w-full" /></UFormField
            ><UFormField
              :name="`content.${item.value}.description`"
              :label="t('products.description')"
              :help="t('products.markdownHelp')"
              ><UTextarea v-model="state.content[item.value].description" :rows="8" class="w-full" /></UFormField
            ><UFormField :name="`nextSteps.${item.value}`" :label="t('products.nextSteps')"
              ><UTextarea v-model="state.nextSteps[item.value]" class="w-full"
            /></UFormField>
          </div>
        </template>
      </UTabs>
      <UFormField name="prices" :label="t('products.prices')"
        ><div class="space-y-3">
          <div v-for="(price, index) in state.prices" :key="index" class="flex flex-wrap items-end gap-3">
            <UFormField :name="`prices.${index}.currency`" :label="t('products.currency')"
              ><USelect v-model="price.currency" :items="currencyOptions" class="w-28" /></UFormField
            ><UFormField :name="`prices.${index}.amount`" :label="t('products.amount')"
              ><UInput
                type="number"
                :step="1 / currencyScale(price.currency || 'EUR')"
                :model-value="price.amount / currencyScale(price.currency || 'EUR')"
                @update:model-value="
                  price.amount = Math.round(Number($event) * currencyScale(price.currency || 'EUR'))
                " /></UFormField
            ><UFormField :name="`prices.${index}.taxBehavior`" :label="t('products.tax')"
              ><USelect v-model="price.taxBehavior" :items="taxOptions" /></UFormField
            ><UButton
              icon="i-lucide-x"
              variant="ghost"
              color="neutral"
              :aria-label="t('products.removePrice')"
              @click="state.prices.splice(index, 1)"
            />
          </div>
          <UButton
            variant="outline"
            icon="i-lucide-plus"
            @click="state.prices.push({ currency: 'USD', amount: 1000, taxBehavior: 'inclusive' })"
            >{{ t('products.addPrice') }}</UButton
          >
        </div></UFormField
      >
      <UFormField name="taxCode" :label="t('products.taxCode')"><UInput v-model="state.taxCode" /></UFormField>
      <UFormField name="videoUrl" :label="t('products.videoUrl')"
        ><UInput v-model="state.videoUrl" class="w-full"
      /></UFormField>
      <p v-if="!product" class="text-muted">{{ t('products.saveBeforeUpload') }}</p>
      <template v-else
        ><fieldset v-for="visibility in ['public', 'private'] as const" :key="visibility" class="space-y-3">
          <legend class="font-medium">{{ t(visibility === 'public' ? 'products.images' : 'products.files') }}</legend>
          <UFormField :name="visibility === 'public' ? 'imageIds' : 'fileIds'"
            ><div class="space-y-2">
              <div
                v-for="(id, index) in visibility === 'public' ? state.imageIds : state.fileIds"
                :key="id"
                class="flex items-center gap-2"
              >
                <span class="min-w-0 flex-1 truncate">{{ assets.find((a) => a.id === id)?.name || id }}</span
                ><UButton
                  icon="i-lucide-arrow-up"
                  variant="ghost"
                  :aria-label="t('products.moveUp')"
                  @click="move(visibility === 'public' ? state.imageIds : state.fileIds, index, -1)"
                /><UButton
                  icon="i-lucide-arrow-down"
                  variant="ghost"
                  :aria-label="t('products.moveDown')"
                  @click="move(visibility === 'public' ? state.imageIds : state.fileIds, index, 1)"
                /><UButton
                  icon="i-lucide-x"
                  variant="ghost"
                  :aria-label="t('products.removeFile')"
                  @click="(visibility === 'public' ? state.imageIds : state.fileIds).splice(index, 1)"
                />
              </div></div></UFormField
          ><label class="block"
            ><span class="mb-2 block text-sm">{{ t('products.upload') }}</span
            ><UInput
              type="file"
              :disabled="busy"
              :accept="
                visibility === 'public'
                  ? 'image/png,image/jpeg,image/webp,image/avif'
                  : '.pdf,.zip,.mp3,.m4a,.wav,.ogg,.mp4,.webm,.txt,.docx'
              "
              @change="upload($event, visibility)"
          /></label></fieldset
      ></template>
      <div class="flex justify-end gap-3">
        <UButton variant="outline" color="neutral" @click="emit('cancel')">{{ t('products.cancel') }}</UButton
        ><UButton type="submit" :loading="busy" :disabled="busy">{{ t('products.save') }}</UButton>
      </div></UForm
    >
  </div>
  <UModal
    v-model:open="categoriesOpen"
    :title="t('products.manageCategories')"
    :ui="{ content: 'pointer-events-auto' }"
  >
    <template #body><ProductsCategories @saved="categorySaved" @changed="loadCategories" /></template>
  </UModal>
</template>
