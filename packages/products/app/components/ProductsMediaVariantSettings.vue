<script setup lang="ts">
import { mediaVariantSettingsSchema, defaultMediaVariantPresets } from '../../shared/media-variants'

const { t } = useI18n(),
  api = useStoreMedia(),
  mediaError = useMediaError(),
  label = useMediaVariantLabel(),
  router = useRouter()
const state = reactive({ presets: defaultMediaVariantPresets(), revision: 1 })
const pending = ref(true),
  saving = ref(false),
  error = ref(''),
  saved = ref(false),
  baseline = ref('')
let persistedRows = new WeakSet<object>()
const schema = useProductFormSchema(mediaVariantSettingsSchema, (issue) => {
  if (issue.code === 'custom' && issue.path[0] === 'presets') {
    return t('products.media.variants.validPresets')
  }
  if (issue.path.at(-1) === 'key') {
    return t('products.media.variants.validKey')
  }
})
const form = ref<{ validate: () => Promise<unknown> }>()
const dirty = computed(() => !pending.value && JSON.stringify(state.presets) !== baseline.value)
async function load() {
  pending.value = true
  error.value = ''
  try {
    const config = await api.presets()
    state.presets = config.presets.map((preset) => ({ ...preset }))
    state.revision = config.revision
    baseline.value = JSON.stringify(state.presets)
    persistedRows = new WeakSet(state.presets)
  } catch (cause) {
    error.value = mediaError(cause)
  } finally {
    pending.value = false
  }
}
onMounted(load)
function add() {
  state.presets.push({ key: '', label: '', width: 800, height: 600 })
  saved.value = false
}
function remove(index: number) {
  if (
    state.presets[index] &&
    !(state.presets[index]!.key === 'thumbnail' && persistedRows.has(state.presets[index]!))
  ) {
    state.presets.splice(index, 1)
    saved.value = false
  }
}
async function save() {
  try {
    await form.value?.validate()
  } catch {
    return false
  }
  saving.value = true
  saved.value = false
  error.value = ''
  try {
    const config = await api.savePresets(state.presets, state.revision)
    state.revision = config.revision
    state.presets = config.presets.map((preset) => ({ ...preset }))
    baseline.value = JSON.stringify(state.presets)
    persistedRows = new WeakSet(state.presets)
    saved.value = true
    return true
  } catch (cause) {
    error.value =
      (cause as { statusCode?: number; data?: { data?: { code?: string } } }).statusCode === 409 &&
      !(cause as { data?: { data?: { code?: string } } }).data?.data?.code
        ? t('products.media.variants.settingsConflict')
        : mediaError(cause)
    return false
  } finally {
    saving.value = false
  }
}
const discardOpen = ref(false)
let destination = '',
  allow = false
onBeforeRouteLeave((to) => {
  if (saving.value) {
    return false
  }
  if (!dirty.value || allow) {
    return true
  }
  destination = to.fullPath
  discardOpen.value = true
  return false
})
function discard() {
  allow = true
  discardOpen.value = false
  return router.push(destination)
}
async function saveAndLeave() {
  if (await save()) {
    await discard()
  } else {
    discardOpen.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-lg font-semibold">{{ t('products.media.variants.settings') }}</h2>
      <p class="text-sm text-muted">{{ t('products.media.variants.settingsHelp') }}</p>
    </div>
    <UAlert v-if="error" color="error" :description="error"
      ><template #actions
        ><UButton v-if="!dirty" @click="load">{{ t('products.media.retry') }}</UButton></template
      ></UAlert
    >
    <UAlert v-if="saved" color="success" :description="t('products.media.variants.settingsSaved')" />
    <p v-if="pending" role="status">{{ t('products.media.loading') }}</p>
    <UForm v-else ref="form" :schema="schema" :state="state" novalidate class="space-y-4" @submit="save">
      <UFormField name="presets" :label="t('products.media.variants.presets')" class="w-full">
        <div class="w-full space-y-3">
          <UCard v-for="(preset, index) in state.presets" :key="index">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="font-medium">{{ preset.label ? label(preset) : t('products.media.variants.newVariant') }}</h3>
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-trash-2"
                :disabled="saving || (preset.key === 'thumbnail' && persistedRows.has(preset))"
                :aria-label="t('products.media.variants.remove')"
                @click="remove(index)"
              />
            </div>
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <UFormField :name="`presets.${index}.key`" :label="t('products.media.variants.key')" required
                ><UInput v-model="preset.key" :readonly="persistedRows.has(preset)" :disabled="saving" class="w-full"
              /></UFormField>
              <UFormField :name="`presets.${index}.label`" :label="t('products.media.variants.label')" required
                ><UInput v-model="preset.label" :disabled="saving" class="w-full"
              /></UFormField>
              <UFormField :name="`presets.${index}.width`" :label="t('products.width')" required
                ><UInputNumber v-model="preset.width" :min="16" :max="2400" :disabled="saving" class="w-full"
              /></UFormField>
              <UFormField :name="`presets.${index}.height`" :label="t('products.height')" required
                ><UInputNumber v-model="preset.height" :min="16" :max="2400" :disabled="saving" class="w-full"
              /></UFormField>
            </div>
          </UCard>
        </div>
      </UFormField>
      <p class="text-sm text-muted">{{ t('products.media.variants.keyHelp') }}</p>
      <div class="flex flex-wrap justify-between gap-3">
        <UButton
          type="button"
          variant="outline"
          icon="i-lucide-plus"
          :disabled="saving || state.presets.length >= 12"
          @click="add"
          >{{ t('products.media.variants.add') }}</UButton
        ><UButton type="submit" :loading="saving" :disabled="saving || !dirty">{{ t('products.media.save') }}</UButton>
      </div>
    </UForm>
    <UModal v-if="discardOpen" v-model:open="discardOpen" :dismissible="!saving" :title="t('products.media.unsaved')"
      ><template #body
        ><p>{{ t('products.media.unsavedHelp') }}</p></template
      ><template #footer
        ><UButton color="neutral" variant="outline" :disabled="saving" @click="discardOpen = false">{{
          t('products.media.keepEditing')
        }}</UButton
        ><UButton color="neutral" variant="outline" :disabled="saving" @click="discard">{{
          t('products.media.discard')
        }}</UButton
        ><UButton :loading="saving" :disabled="saving" @click="saveAndLeave">{{
          t('products.media.save')
        }}</UButton></template
      ></UModal
    >
  </div>
</template>
