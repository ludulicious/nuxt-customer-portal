<script setup lang="ts">
import { portalLanguages } from '@nuxt-customer-portal/core/shared/languages'
import type { z } from 'zod'
import type { Product, Asset, ProductCategory } from '../../shared/types'
import { emptyProduct, productSchema, hasRequiredPrices } from '../../shared/validation'
import { currencyScale } from '../../shared/money'

const props = withDefaults(
    defineProps<{
      product?: Product
      section?: 'all' | 'basic' | 'details' | 'pricing' | 'media'
      currency?: string
      language?: 'en' | 'nl'
    }>(),
    {
      section: 'all'
    }
  ),
  emit = defineEmits<{ saved: [product: Product]; cancel: [] }>()
const { t } = useI18n(),
  api = useProducts(),
  schema = useProductFormSchema(productSchema)
const state = reactive<z.infer<typeof productSchema>>(
  props.product
    ? {
        isFree: false,
        ...structuredClone(toRaw(props.product)),
        prices: props.product.isFree ? [] : structuredClone(toRaw(props.product.prices))
      }
    : emptyProduct()
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
  ...categories.value.map((category) => ({
    label: category.content[defaultLanguage.value].name || category.name,
    value: `category:${category.id}`
  }))
])
const selectedCategory = computed({
  get: () => (state.categoryId ? `category:${state.categoryId}` : 'none'),
  set: (value: string) => {
    state.categoryId = value === 'none' ? null : value.slice('category:'.length)
  }
})
async function loadCategories() {
  categories.value = await api.categories()
}
async function categorySaved(category: ProductCategory) {
  state.categoryId = category.id
  categoriesOpen.value = false
  await loadCategories()
}
const selectedLanguage = ref<'en' | 'nl'>(props.language || 'en')
const defaultLanguage = ref<'en' | 'nl'>('en')
const supportedLanguages = ref<('en' | 'nl')[]>([])
const languageReady = ref(false)
const languageOptions = computed(() =>
  [defaultLanguage.value, ...supportedLanguages.value.filter((value) => value !== defaultLanguage.value)].map(
    (value) => ({
      value,
      disabled: !languageReady.value,
      label: portalLanguages.find((language) => language.value === value)!.label
    })
  )
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
const currencies = ref<string[]>([])
const settingsReady = ref(false)
const visiblePrices = computed(() =>
  state.prices
    .map((price, index) => ({ price, index }))
    .filter(({ price }) => !props.currency || price.currency === props.currency)
)
const pricingErrors = () =>
  !state.isFree && !hasRequiredPrices(state, currencies.value)
    ? [{ name: 'prices', message: t('products.requiredPrices') }]
    : []
watch(
  () => state.isFree,
  (free) => {
    if (free) {
      state.prices = []
    } else {
      state.prices = currencies.value.map((currency) => ({ currency, amount: 0, taxBehavior: 'inclusive' }))
    }
  }
)
const types = computed(() => ['digital', 'service'].map((value) => ({ value, label: t(`products.${value}`) })))
const taxOptions = computed(() => ['inclusive', 'exclusive'].map((value) => ({ value, label: t(`products.${value}`) })))
onMounted(async () => {
  if (props.section === 'all' || props.section === 'details') {
    await loadCategories().catch(() => {
      error.value = t('products.loadFailed')
    })
  }
  try {
    const settings = await api.settings()
    currencies.value = settings.currencies
    if (!state.isFree && (props.section === 'all' || props.section === 'pricing')) {
      state.prices = settings.currencies.map(
        (currency) =>
          state.prices.find((price) => price.currency === currency) || { currency, amount: 0, taxBehavior: 'inclusive' }
      )
    }
    settingsReady.value = true
    supportedLanguages.value = settings.languages
    defaultLanguage.value = settings.defaultLocale
    selectedLanguage.value = props.language || settings.defaultLocale
  } catch {
    error.value = t('products.languageLoadFailed')
  } finally {
    languageReady.value = true
  }
  if (props.product && (props.section === 'all' || props.section === 'media')) {
    assets.value = await api.assets(props.product.id)
  }
  await nextTick()
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
      :validate="pricingErrors"
      novalidate
      class="space-y-5"
      @submit="save"
      @error="showInvalidLanguage"
    >
      <UAlert v-if="error" color="error" :title="error" />
      <UAlert
        v-if="settingsReady && (section === 'basic' || section === 'media') && pricingErrors().length"
        color="warning"
        :title="t('products.requiredPrices')"
      />
      <template v-if="section === 'all' || section === 'details'">
        <div :class="section === 'details' ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-2'">
          <UFormField name="slug" :label="t('products.slug')"><UInput v-model="state.slug" class="w-full" /></UFormField
          ><UFormField name="categoryId" :label="t('products.category')"
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
                :aria-label="t('products.addCategory')"
                @click="categoriesOpen = true"
              /></div></UFormField
          ><UFormField name="type" :label="t('products.type')"
            ><USelect v-model="state.type" :items="types" class="w-full" /></UFormField
          ><UFormField name="status" :label="t('products.status')"
            ><div class="flex min-h-8 items-center gap-3">
              <UBadge color="neutral" variant="subtle">{{ t(`products.${state.status}`) }}</UBadge>
            </div></UFormField
          >
        </div>
      </template>
      <template v-if="section === 'all' || section === 'basic'">
        <UTabs
          v-model="selectedLanguage"
          :items="languageOptions"
          variant="link"
          :ui="{ list: language ? 'hidden' : 'justify-start', trigger: 'grow-0' }"
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
      </template>
      <template v-if="section === 'all' || section === 'details'">
        <UFormField name="isFree" :label="t('products.freeProduct')"><USwitch v-model="state.isFree" /></UFormField>
        <UFormField name="taxCode" :label="t('products.taxCode')"
          ><UInput v-model="state.taxCode" class="w-full sm:max-w-xs"
        /></UFormField>
      </template>
      <template
        v-if="section === 'all' || section === 'pricing' || (section === 'details' && product?.isFree && !state.isFree)"
      >
        <UFormField
          v-if="!state.isFree"
          name="prices"
          :label="currency ? undefined : t('products.prices')"
          :help="currency ? undefined : t('products.requiredPrices')"
          ><div class="space-y-3">
            <div
              v-for="{ price, index } in visiblePrices"
              :key="index"
              :class="currency ? 'grid gap-4' : 'flex flex-wrap items-end gap-3'"
            >
              <UFormField v-if="!currency" :name="`prices.${index}.currency`" :label="t('products.currency')"
                ><span class="block py-2 font-medium">{{ price.currency }}</span></UFormField
              ><UFormField :name="`prices.${index}.amount`" :label="t('products.amount')"
                ><UInputNumber
                  class="w-full"
                  :format-options="{
                    style: 'currency',
                    currency: price.currency,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  }"
                  :increment="false"
                  :decrement="false"
                  :step="1 / currencyScale(price.currency || 'EUR')"
                  :model-value="price.amount / currencyScale(price.currency || 'EUR')"
                  @update:model-value="
                    price.amount = Math.round(Number($event) * currencyScale(price.currency || 'EUR'))
                  " /></UFormField
              ><UFormField :name="`prices.${index}.taxBehavior`" :label="t('products.tax')"
                ><USelect v-model="price.taxBehavior" :items="taxOptions" class="w-full"
              /></UFormField>
            </div></div
        ></UFormField>
      </template>
      <template v-if="section === 'all' || section === 'media'">
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
      </template>
      <div class="flex justify-end gap-3">
        <UButton variant="outline" color="neutral" @click="emit('cancel')">{{ t('products.cancel') }}</UButton
        ><UButton type="submit" :loading="busy" :disabled="busy || !settingsReady">{{ t('products.save') }}</UButton>
      </div></UForm
    >
  </div>
  <UModal v-model:open="categoriesOpen" :title="t('products.addCategory')" :ui="{ content: 'pointer-events-auto' }">
    <template #body><ProductsCategoryForm embedded @saved="categorySaved" @cancel="categoriesOpen = false" /></template>
  </UModal>
</template>
