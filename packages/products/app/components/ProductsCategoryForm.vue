<script setup lang="ts">
import { UCard } from '#components'
import { portalLanguages } from '@nuxt-customer-portal/core/shared/languages'
import { categorySchema } from '../../shared/validation'
import type { ProductCategory, Locale } from '../../shared/types'

const props = defineProps<{ category?: ProductCategory; embedded?: boolean }>()
const emit = defineEmits<{ saved: [category: ProductCategory]; cancel: [] }>()
const { t } = useI18n(),
  api = useProducts()
const state = reactive(
  props.category
    ? structuredClone(toRaw(props.category))
    : { code: '', content: { en: { name: '', description: '' }, nl: { name: '', description: '' } } }
)
const schema = useProductFormSchema(categorySchema, (issue) =>
  issue.path[0] === 'code' && !state.code.trim() ? t('products.categoryCodeRequired') : undefined
)
const languages = ref<Locale[]>([]),
  selectedLanguage = ref<Locale>('en'),
  busy = ref(false),
  error = ref('')
const form = useTemplateRef('form'),
  root = useTemplateRef('root')
const tabs = computed(() =>
  languages.value.map((value) => ({
    value,
    label: portalLanguages.find((language) => language.value === value)!.label
  }))
)
const validateNames = () =>
  languages.value
    .slice(0, 1)
    .filter((language) => !state.content[language].name.trim())
    .map((language) => ({ name: `content.${language}.name`, message: t('products.categoryNameRequired') }))
const valid = computed(
  () => languages.value.length > 0 && categorySchema.safeParse(state).success && validateNames().length === 0
)
onMounted(async () => {
  try {
    const settings = await api.settings()
    languages.value = [
      settings.defaultLocale,
      ...settings.languages.filter((language) => language !== settings.defaultLocale)
    ]
    selectedLanguage.value = settings.defaultLocale
    await nextTick()
    if (import.meta.client && root.value) {
      if (!props.embedded) {
        const height = root.value.getBoundingClientRect().height
        root.value.scrollIntoView({ behavior: 'smooth', block: height < window.innerHeight - 120 ? 'center' : 'start' })
      }
      root.value.querySelector('input')?.focus({ preventScroll: true })
    }
  } catch {
    error.value = t('products.loadFailed')
  }
})
function invalid(event: { errors: Array<{ name?: string }> }) {
  const language = event.errors.find((issue) => issue.name?.startsWith('content.'))?.name?.split('.')[1]
  if (language === 'en' || language === 'nl') {
    selectedLanguage.value = language
  }
}
async function save() {
  busy.value = true
  error.value = ''
  try {
    emit('saved', await api.saveCategory(state, props.category?.id))
  } catch (e) {
    const field = (e as { data?: { data?: { field?: string } } }).data?.data?.field
    if (field) {
      form.value?.setErrors([
        { name: field, message: t(field === 'code' ? 'products.categoryDuplicate' : 'products.categoryNameRequired') }
      ])
      invalid({ errors: [{ name: field }] })
    } else {
      error.value = t('products.saveFailed')
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div ref="root" class="scroll-mt-24" @keydown.esc.stop="emit('cancel')">
    <component :is="embedded ? 'div' : UCard">
      <template v-if="!embedded" #header
        ><div class="flex items-center justify-between gap-3">
          <h2 class="font-semibold">{{ t(category ? 'products.categoryEditTitle' : 'products.addCategory') }}</h2>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            :aria-label="t('products.close')"
            @click="emit('cancel')"
          /></div
      ></template>
      <UForm
        ref="form"
        :state="state"
        :schema="schema"
        :validate="validateNames"
        novalidate
        class="space-y-4"
        @submit="save"
        @error="invalid"
      >
        <UAlert v-if="error" color="error" :title="error" />
        <UFormField name="code" :label="t('products.categoryCode')" required
          ><UInput v-model="state.code" class="w-full"
        /></UFormField>
        <UTabs
          v-model="selectedLanguage"
          :items="tabs"
          variant="link"
          :ui="{ list: 'justify-start', trigger: 'grow-0' }"
        >
          <template #content="{ item }"
            ><div class="space-y-4 pt-4">
              <UFormField
                :name="`content.${item.value}.name`"
                :label="t('products.categoryName')"
                :required="item.value === languages[0]"
                ><UInput v-model="state.content[item.value].name" class="w-full"
              /></UFormField>
              <UFormField :name="`content.${item.value}.description`" :label="t('products.categoryDescription')"
                ><UTextarea v-model="state.content[item.value].description" :rows="4" class="w-full"
              /></UFormField></div
          ></template>
        </UTabs>
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="outline" @click="emit('cancel')">{{ t('products.cancel') }}</UButton
          ><UButton type="submit" :loading="busy" :disabled="!valid || busy">{{ t('products.save') }}</UButton>
        </div>
      </UForm>
    </component>
  </div>
</template>
