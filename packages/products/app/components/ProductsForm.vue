<script setup lang="ts">
import { orderedProductImageIds, orderedProductImagePlacements } from '../../shared/product-media'

import { portalLanguages } from '@nuxt-customer-portal/core/shared/languages'
import { z } from 'zod'
import { defaultPlanning, defaultPlanningPolicy, productPlanningSchema } from '../../shared/planning'
import type { Product, Asset, ProductCategory } from '../../shared/types'
import {
  emptyProduct,
  productSchema,
  productCreateSchema,
  productContentSchema,
  productPricingSchema,
  hasRequiredPrices
} from '../../shared/validation'
import { currencyScale } from '../../shared/money'
import { fileExtension, withoutFileExtension } from '../../shared/file-name'

const props = withDefaults(
    defineProps<{
      product?: Product
      section?: 'create' | 'all' | 'basic' | 'details' | 'pricing' | 'planning' | 'media' | 'images' | 'files'
      filesMode?: 'add' | 'edit'
      fileId?: string
      currency?: string
      language?: 'en' | 'nl'
      saveRequest?: number
    }>(),
    {
      section: 'all'
    }
  ),
  emit = defineEmits<{ saved: [product: Product]; cancel: []; dirty: [dirty: boolean] }>()
const { t } = useI18n(),
  api = useProducts(),
  schema = useProductFormSchema(productSchema),
  pricingSchema = useProductFormSchema(productPricingSchema),
  contentSchema = useProductFormSchema(productContentSchema),
  planningSchema = useProductFormSchema(z.object({ planning: productPlanningSchema }))
const state = reactive<z.infer<typeof productSchema>>(
  props.product
    ? {
        links: [],
        visibility: 'listed',
        isFree: false,
        requiresFulfillment: false,
        planning: defaultPlanning(),
        ...structuredClone(toRaw(props.product)),
        content: {
          en: {
            ...structuredClone(toRaw(props.product.content.en)),
            subtitle: props.product.content.en.subtitle || '',
            buyButtonLabel: props.product.content.en.buyButtonLabel || '',
            secondaryCta: props.product.content.en.secondaryCta || ''
          },
          nl: {
            ...structuredClone(toRaw(props.product.content.nl)),
            subtitle: props.product.content.nl.subtitle || '',
            buyButtonLabel: props.product.content.nl.buyButtonLabel || '',
            secondaryCta: props.product.content.nl.secondaryCta || ''
          }
        },
        prices: props.product.isFree ? [] : structuredClone(toRaw(props.product.prices))
      }
    : { ...emptyProduct(), prices: [] }
)
for (const id of state.fileIds) {
  state.fileNames[id] ||= { en: '', nl: '' }
}
const initialFileIds = new Set(state.fileIds)
const editableFileIds = computed(() =>
  props.section === 'files' && props.filesMode === 'add'
    ? state.fileIds.filter((id) => !initialFileIds.has(id))
    : props.section === 'files' && props.filesMode === 'edit'
      ? state.fileIds.filter((id) => id === props.fileId)
      : state.fileIds
)
const busy = ref(false),
  saving = ref(false),
  error = ref(''),
  assets = ref<Asset[]>([]),
  form = useTemplateRef('form'),
  root = useTemplateRef('root')
function syncThumbnailImageId() {
  if (!state.thumbnailImageId) {
    state.thumbnailImageId =
      state.imageIds.find((id) => assets.value.find((asset) => asset.id === id)?.image_purpose === 'thumbnail') || null
  }
}
function purchasedFile(id: string) {
  return assets.value.find((asset) => asset.id === id)
}
function setFileName(id: string, language: 'en' | 'nl', value: string) {
  const sourceName = purchasedFile(id)?.name || ''
  state.fileNames[id]![language] = withoutFileExtension(value, sourceName)
}
function normalizeFileNames() {
  for (const id of state.fileIds) {
    const sourceName = purchasedFile(id)?.name || ''
    for (const language of ['en', 'nl'] as const) {
      state.fileNames[id]![language] = withoutFileExtension(state.fileNames[id]![language], sourceName)
    }
  }
}
const categories = ref<ProductCategory[]>([])
const categoriesOpen = ref(false)
const categoryOptions = computed(() => [
  ...(props.section === 'create' ? [] : [{ label: t('products.noCategory'), value: 'none' }]),
  ...categories.value.map((category) => ({
    label: category.content[defaultLanguage.value].name || category.name,
    value: `category:${category.id}`
  }))
])
const selectedCategory = computed({
  get: () => (state.categoryId ? `category:${state.categoryId}` : props.section === 'create' ? undefined : 'none'),
  set: (value: string | undefined) => {
    state.categoryId = !value || value === 'none' ? null : value.slice('category:'.length)
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
const createSchema = computed(() =>
  useProductFormSchema(
    z.object({ ...productCreateSchema.shape }).superRefine((value, context) => {
      if (!value.content[defaultLanguage.value].title.trim()) {
        context.addIssue({ code: 'custom', path: ['content', defaultLanguage.value, 'title'], message: 'required' })
      }
    }),
    (issue) => {
      if (issue.path[0] === 'content' && issue.code === 'custom') {
        return t('products.productNameRequired')
      }
      if (issue.path[0] === 'slug' && !state.slug.trim()) {
        return t('products.slugRequired')
      }
    }
  )
)
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
const purchasedFilesUploading = ref(false)
const visiblePrices = computed(() =>
  state.prices
    .map((price, index) => ({ price, index }))
    .filter(({ price }) => props.section === 'pricing' || !props.currency || price.currency === props.currency)
)
const pricingErrors = () =>
  state.status === 'published' && !state.isFree && !hasRequiredPrices(state, currencies.value)
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
const slugManuallyEdited = ref(false)
const createName = computed({
  get: () => state.content[defaultLanguage.value].title,
  set: (value: string) => {
    state.content[defaultLanguage.value].title = value
    if (!slugManuallyEdited.value) {
      state.slug = value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120)
        .replace(/-$/g, '')
    }
  }
})
const planningProviders = ref<Array<{ userId: string; name: string; enabled: boolean; image?: string | null }>>([])
const planningProviderOptions = computed(() =>
  planningProviders.value
    .filter((member) => member.enabled || state.planning.providerUserIds.includes(member.userId))
    .map((member) => ({
      value: member.userId,
      name: member.name,
      image: member.image,
      label: member.enabled ? member.name : t('products.planningMemberDisabled', { name: member.name }),
      disabled: !member.enabled
    }))
)
const appointmentSetupRequired = computed(() => state.planning.enabled && !planningProviderOptions.value.length)

function togglePlanningMember(id: string, checked: boolean) {
  state.planning.providerUserIds = checked
    ? [...new Set([...state.planning.providerUserIds, id])]
    : state.planning.providerUserIds.filter((value) => value !== id)
}
const planningInstalled = ref(false)
const planningDefaults = ref(defaultPlanningPolicy())
const planningPolicy = computed({
  get: () => ({ ...planningDefaults.value, ...state.planning.policyOverrides }),
  set: (value) => {
    state.planning.policyOverrides = Object.fromEntries(
      Object.keys(state.planning.policyOverrides).map((key) => [key, value[key as keyof typeof value]])
    ) as typeof state.planning.policyOverrides
  }
})
const types = computed(() => ['digital', 'service'].map((value) => ({ value, label: t(`products.${value}`) })))
async function loadInitialData() {
  try {
    planningProviders.value = await $fetch<typeof planningProviders.value, string>('/api/planning/admin/providers')
    planningDefaults.value = await $fetch<typeof planningDefaults.value, string>('/api/planning/admin/policy')
    planningInstalled.value = true
  } catch {
    /* Planning is an optional package. */
  }

  if (props.section === 'create' || props.section === 'all' || props.section === 'details') {
    await loadCategories().catch(() => {
      error.value = t('products.loadFailed')
    })
  }
  try {
    const settings = await api.settings()
    currencies.value = settings.currencies
    if (!state.isFree && (props.section === 'create' || props.section === 'all' || props.section === 'pricing')) {
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
  if (props.product && ['all', 'media', 'images', 'files'].includes(props.section)) {
    assets.value = await api.assets(props.product!.id)
    if (['all', 'images'].includes(props.section)) {
      Object.assign(
        state,
        orderedProductImagePlacements(
          orderedProductImageIds(
            state.imageIds,
            assets.value,
            state.imageSelection === 'ordered' ? null : state.thumbnailImageId
          )
        )
      )
    } else {
      syncThumbnailImageId()
    }
    normalizeFileNames()
  }
}
await loadInitialData()
const initialStateSnapshot = JSON.stringify(toRaw(state))
watch(
  () => JSON.stringify(state),
  (value) => emit('dirty', value !== initialStateSnapshot),
  { flush: 'sync' }
)
onMounted(() => root.value?.querySelector('input')?.focus({ preventScroll: true }))
async function save() {
  if (props.section === 'planning' && appointmentSetupRequired.value) {
    return
  }
  if (['basic', 'pricing'].includes(props.section) && props.product) {
    saving.value = true
    error.value = ''
    try {
      emit(
        'saved',
        props.section === 'pricing'
          ? await api.savePricing(props.product.id, { isFree: state.isFree, prices: state.prices })
          : await api.saveContent(props.product.id, { content: state.content, nextSteps: state.nextSteps })
      )
    } catch (e) {
      error.value = t('products.saveFailed')
      const field = (e as { data?: { data?: { field?: string } } }).data?.data?.field
      if (field) {
        form.value?.setErrors([
          { name: field, message: t(props.section === 'pricing' ? 'products.requiredPrices' : 'products.conflict') }
        ])
      }
    } finally {
      saving.value = false
    }
    return
  }
  if (props.section === 'planning' && props.product) {
    saving.value = true
    error.value = ''
    try {
      const saved = await $fetch<Product, string>(
        `/api/planning/admin/products/${encodeURIComponent(props.product.id)}`,
        {
          method: 'PUT',
          body: state.planning
        }
      )
      emit('saved', saved)
    } catch (e) {
      error.value = t('products.saveFailed')
      const field = (e as { data?: { data?: { field?: string } } }).data?.data?.field
      if (field) {
        form.value?.setErrors([{ name: field, message: t('products.conflict') }])
      }
    } finally {
      saving.value = false
    }
    return
  }
  syncThumbnailImageId()
  const missingFileName = state.fileIds.flatMap((id) =>
    supportedLanguages.value
      .filter((language) => !state.fileNames[id]?.[language]?.trim())
      .map((language) => `fileNames.${id}.${language}`)
  )[0]
  if (missingFileName) {
    form.value?.setErrors([{ name: missingFileName, message: t('products.fileNameRequired') }])
    await nextTick()
    root.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  saving.value = true
  error.value = ''
  try {
    emit('saved', await api.save(state, props.product?.id))
  } catch (e) {
    error.value = t('products.saveFailed')
    const field = (e as { data?: { data?: { field?: string } } }).data?.data?.field
    if (field) {
      form.value?.setErrors([
        {
          name: field,
          message: field.startsWith('fileNames.') ? t('products.fileNameRequired') : t('products.conflict')
        }
      ])
    }
    await nextTick()
    root.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  } finally {
    saving.value = false
  }
}
watch(
  () => props.saveRequest,
  (value, previous) => {
    if (value && value !== previous) {
      void save()
    }
  }
)
async function uploadPurchasedFile(file: File) {
  if (!props.product) {
    return
  }
  const id = await api.upload(props.product.id, file, 'private')
  state.fileIds.push(id)
  state.fileNames[id] = { en: '', nl: '' }
  assets.value = await api.assets(props.product.id)
}
function move(ids: string[], index: number, delta: number) {
  const target = index + delta
  if (target < 0 || target >= ids.length) {
    return
  }
  const [id] = ids.splice(index, 1)
  ids.splice(target, 0, id!)
}
function removeFile(id: string, index: number) {
  Reflect.deleteProperty(state.fileNames, id)
  state.fileIds.splice(index, 1)
}
</script>

<template>
  <div ref="root" class="scroll-mt-24" @keydown.esc.stop="emit('cancel')">
    <UForm
      ref="form"
      :state="state"
      :schema="
        section === 'create'
          ? createSchema
          : section === 'planning'
            ? planningSchema
            : section === 'pricing'
              ? pricingSchema
              : section === 'basic'
                ? contentSchema
                : schema
      "
      :validate="['planning', 'basic'].includes(section) ? undefined : pricingErrors"
      novalidate
      class="space-y-5"
      @submit="save"
      @error="showInvalidLanguage"
    >
      <UAlert v-if="error" color="error" :title="error" />
      <div
        v-if="planningInstalled && state.type === 'service' && ['all', 'planning'].includes(section)"
        :class="section === 'planning' ? 'space-y-4' : 'space-y-4 rounded border border-default p-4'"
      >
        <UFormField v-if="!appointmentSetupRequired" name="planning.enabled">
          <div class="flex items-center justify-between gap-4 rounded-lg border border-default bg-muted/20 p-3">
            <div class="flex min-w-0 items-center gap-3">
              <span class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UIcon name="i-lucide-calendar-check-2" class="size-4" />
              </span>
              <span class="text-sm font-semibold text-highlighted">{{ t('products.plannable') }}</span>
            </div>
            <USwitch v-model="state.planning.enabled" :aria-label="t('products.plannable')" />
          </div>
        </UFormField>
        <template v-if="state.planning.enabled">
          <div
            v-if="!appointmentSetupRequired"
            class="grid gap-4"
            :class="{ 'sm:grid-cols-2': section !== 'planning' }"
          >
            <UFormField name="planning.durationMinutes" :label="t('products.durationMinutes')"
              ><UInputNumber v-model="state.planning.durationMinutes" :min="1" class="w-full"
            /></UFormField>
            <UFormField name="planning.meetingProvider" :label="t('products.meetingProvider')"
              ><USelect
                v-model="state.planning.meetingProvider"
                class="w-full"
                :items="[
                  { value: 'none', label: t('products.noMeeting') },
                  { value: 'zoom', label: 'Zoom' }
                ]"
            /></UFormField>
          </div>
          <UFormField
            name="planning.providerUserIds"
            :label="appointmentSetupRequired ? undefined : t('products.planningProviders')"
            :error="planningProviderOptions.length ? undefined : false"
          >
            <div class="space-y-2">
              <div
                v-if="!planningProviderOptions.length"
                class="space-y-3 rounded-lg border border-default bg-elevated p-3"
              >
                <p class="text-sm text-muted">{{ t('products.noEligibleAppointmentMembers') }}</p>
                <UButton to="/admin/planning" size="sm" variant="soft" icon="i-lucide-users">{{
                  t('products.enableTeamScheduling')
                }}</UButton>
              </div>
              <label
                v-for="member in planningProviderOptions"
                :key="member.value"
                class="flex items-center gap-3 rounded-lg border p-3 transition-colors"
                :class="[
                  state.planning.providerUserIds.includes(member.value)
                    ? 'border-primary bg-primary/5'
                    : 'border-default',
                  member.disabled ? 'opacity-60' : 'cursor-pointer hover:bg-elevated'
                ]"
              >
                <UCheckbox
                  :model-value="state.planning.providerUserIds.includes(member.value)"
                  :disabled="member.disabled"
                  :aria-label="member.label"
                  @update:model-value="togglePlanningMember(member.value, Boolean($event))"
                />
                <UAvatar :src="member.image || undefined" :alt="member.name" size="sm" />
                <span class="min-w-0 break-words text-sm font-medium">{{ member.label }}</span>
              </label>
            </div>
          </UFormField>
          <div v-if="!appointmentSetupRequired" class="border-t border-default pt-4">
            <p class="text-sm font-semibold text-highlighted">{{ t('products.overridePlanningPolicy') }}</p>
          </div>
          <PlanningPolicyFields
            v-if="!appointmentSetupRequired"
            v-model="planningPolicy"
            v-model:overrides="state.planning.policyOverrides"
            prefix="planning.policyOverrides."
            :currencies="currencies"
            :compact="section === 'planning'"
          />
        </template>
      </div>
      <UAlert
        v-if="settingsReady && (section === 'basic' || section === 'media') && pricingErrors().length"
        color="warning"
        :title="t('products.requiredPrices')"
      />
      <UFormField
        v-if="section === 'create'"
        :name="`content.${defaultLanguage}.title`"
        :label="t('products.name')"
        required
      >
        <UInput v-model="createName" :disabled="!settingsReady" class="w-full" />
      </UFormField>
      <template v-if="section === 'create' || section === 'all' || section === 'details'">
        <div :class="section === 'details' ? 'grid gap-4' : 'grid gap-4 sm:grid-cols-2'">
          <UFormField name="visibility" :label="t('products.visibility')" :help="t('products.visibilityHelp')">
            <USelect
              v-model="state.visibility"
              :items="[
                { value: 'listed', label: t('products.listed') },
                { value: 'unlisted', label: t('products.unlisted') }
              ]"
              class="w-full"
            />
          </UFormField>
          <UFormField name="slug" :label="t('products.slug')" :required="section === 'create'"
            ><UInput
              v-model="state.slug"
              :disabled="state.visibility === 'unlisted'"
              class="w-full"
              @update:model-value="slugManuallyEdited = true" /></UFormField
          ><UFormField name="categoryId" :label="t('products.category')" :required="section === 'create'"
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
          ><UFormField name="type" :label="t('products.type')" :required="section === 'create'"
            ><USelect v-model="state.type" :items="types" class="w-full"
          /></UFormField>
          <UFormField
            name="requiresFulfillment"
            :label="t('products.requiresFulfillment')"
            :help="t('products.requiresFulfillmentHelp')"
          >
            <USwitch v-model="state.requiresFulfillment" :aria-label="t('products.requiresFulfillment')" />
          </UFormField>
          <UFormField v-if="section !== 'create'" name="status" :label="t('products.status')"
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
              ><UFormField :name="`content.${item.value}.subtitle`" :label="t('products.subtitle')"
                ><UInput v-model="state.content[item.value].subtitle" class="w-full" /></UFormField
              ><UFormField :name="`content.${item.value}.secondaryCta`" :label="t('products.secondaryCta')"
                ><UInput
                  v-model="state.content[item.value].secondaryCta"
                  :placeholder="t('products.secondaryCtaPlaceholder')"
                  class="w-full" /></UFormField
              ><UFormField :name="`content.${item.value}.buyButtonLabel`" :label="t('products.buyButtonLabel')"
                ><UInput
                  v-model="state.content[item.value].buyButtonLabel"
                  :placeholder="t('products.buyButtonLabelPlaceholder')"
                  class="w-full" /></UFormField
              ><UFormField :name="`content.${item.value}.summary`" :label="t('products.summary')"
                ><PortalMarkdownEditor
                  v-model="state.content[item.value].summary"
                  :rows="4"
                  class="w-full" /></UFormField
              ><UFormField
                :name="`content.${item.value}.description`"
                :label="t('products.description')"
                :help="t('products.markdownHelp')"
                ><PortalMarkdownEditor
                  v-model="state.content[item.value].description"
                  :rows="15"
                  class="w-full" /></UFormField
              ><UFormField :name="`nextSteps.${item.value}`" :label="t('products.nextSteps')"
                ><UTextarea v-model="state.nextSteps[item.value]" class="w-full"
              /></UFormField>
            </div>
          </template>
        </UTabs>
      </template>
      <template v-if="section === 'create' || section === 'all' || section === 'details' || section === 'pricing'">
        <UFormField name="isFree" :label="t('products.freeProduct')">
          <USwitch v-model="state.isFree" />
        </UFormField>
      </template>
      <template v-if="section === 'create' || section === 'all' || section === 'details'">
        <UFormField v-if="section !== 'create'" name="taxCode" :label="t('products.taxCode')"
          ><UInput v-model="state.taxCode" class="w-full sm:max-w-xs"
        /></UFormField>
      </template>
      <template v-if="section === 'all' || section === 'pricing'">
        <UFormField
          v-if="!state.isFree"
          name="prices"
          :label="currency && section !== 'pricing' ? undefined : t('products.prices')"
          :help="t('products.requiredPrices')"
          ><div class="space-y-3">
            <div
              v-for="{ price, index } in visiblePrices"
              :key="index"
              :class="currency ? 'grid gap-4' : 'flex flex-wrap items-end gap-3'"
            >
              <UFormField
                v-if="!currency || section === 'pricing'"
                :name="`prices.${index}.currency`"
                :label="t('products.currency')"
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
                  "
              /></UFormField>
            </div></div
        ></UFormField>
      </template>
      <template v-if="section === 'all' || section === 'media'">
        <UFormField name="videoUrl" :label="t('products.videoUrl')"
          ><UInput v-model="state.videoUrl" class="w-full"
        /></UFormField>
      </template>
      <template v-if="section === 'all' || section === 'images' || section === 'files'">
        <p v-if="!product" class="text-muted">{{ t('products.saveBeforeUpload') }}</p>
        <template v-else>
          <ProductsImageLibrary
            v-if="section === 'all' || section === 'images'"
            v-model:image-ids="state.imageIds"
            v-model:thumbnail-image-id="state.thumbnailImageId"
            v-model:gallery-image-ids="state.galleryImageIds"
            v-model:detail-image-ids="state.detailImageIds"
            :product-id="product.id"
            :assets="assets"
            :busy="busy || saving"
            @linked="(asset) => assets.push(asset)"
          />
          <div v-if="section === 'all' || section === 'files'" class="space-y-3">
            <UFormField name="fileIds">
              <div class="space-y-2">
                <div v-for="id in editableFileIds" :key="id" class="space-y-3 rounded-lg border border-default p-3">
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-file" class="size-5 shrink-0 text-muted" />
                    <span class="min-w-0 flex-1 truncate text-sm text-muted">{{
                      assets.find((a) => a.id === id)?.name || id
                    }}</span>
                    <UButton
                      icon="i-lucide-arrow-up"
                      color="neutral"
                      variant="ghost"
                      :aria-label="t('products.moveUp')"
                      :disabled="state.fileIds.indexOf(id) === 0"
                      @click="move(state.fileIds, state.fileIds.indexOf(id), -1)"
                    />
                    <UButton
                      icon="i-lucide-arrow-down"
                      color="neutral"
                      variant="ghost"
                      :aria-label="t('products.moveDown')"
                      :disabled="state.fileIds.indexOf(id) === state.fileIds.length - 1"
                      @click="move(state.fileIds, state.fileIds.indexOf(id), 1)"
                    />
                    <UButton
                      icon="i-lucide-x"
                      color="error"
                      variant="ghost"
                      :aria-label="t('products.removeFile')"
                      @click="removeFile(id, state.fileIds.indexOf(id))"
                    />
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <UFormField
                      v-for="languageOption in languageOptions"
                      :key="languageOption.value"
                      :name="`fileNames.${id}.${languageOption.value}`"
                      :label="t('products.fileNameInLanguage', { language: languageOption.label })"
                      :help="
                        t('products.fileExtensionAddedAutomatically', {
                          extension: fileExtension(purchasedFile(id)?.name || '')
                        })
                      "
                    >
                      <UInput
                        :model-value="state.fileNames[id]![languageOption.value]"
                        class="w-full"
                        @update:model-value="setFileName(id, languageOption.value, String($event))"
                      />
                    </UFormField>
                  </div>
                </div>
              </div>
            </UFormField>
            <ProductsPurchasedFileUpload
              v-if="section !== 'files' || filesMode === 'add'"
              :disabled="saving"
              :upload="uploadPurchasedFile"
              @update:uploading="purchasedFilesUploading = $event"
            />
          </div>
        </template>
      </template>
      <div class="flex justify-end gap-3">
        <UButton
          variant="outline"
          color="neutral"
          :disabled="busy || saving || purchasedFilesUploading"
          @click="emit('cancel')"
          >{{ t('products.cancel') }}</UButton
        ><UButton
          v-if="section !== 'planning' || !appointmentSetupRequired"
          type="submit"
          icon="i-lucide-save"
          class="ml-auto flex min-w-28 justify-center"
          :loading="saving"
          :disabled="busy || saving || purchasedFilesUploading || !settingsReady"
          >{{ t('products.save') }}</UButton
        >
      </div></UForm
    >
  </div>
  <UModal
    v-if="categoriesOpen"
    v-model:open="categoriesOpen"
    :title="t('products.addCategory')"
    :ui="{ content: 'pointer-events-auto' }"
  >
    <template #body><ProductsCategoryForm embedded @saved="categorySaved" @cancel="categoriesOpen = false" /></template>
  </UModal>
</template>
