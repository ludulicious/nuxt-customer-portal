<script setup lang="ts">
import type { PortalSettings } from '../../../shared/settings'

const state = defineModel<PortalSettings>({ required: true })
const emit = defineEmits<{ error: [message: string] }>()
const { t } = useI18n()
type BrandAssetField = 'markLight' | 'markDark' | 'logoLight' | 'logoDark'
const assetErrors = reactive<Partial<Record<BrandAssetField, string>>>({})
const assetFields = computed<BrandAssetField[]>(() => {
  if (state.value.appearance.colorMode === 'light-only') return ['markLight', 'logoLight']
  if (state.value.appearance.colorMode === 'dark-only') return ['markDark', 'logoDark']
  return ['markLight', 'markDark', 'logoLight', 'logoDark']
})

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

function readDimensions(source: string) {
  return new Promise<{ width: number, height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Could not decode image'))
    image.src = source
  })
}

function rejectImage(field: BrandAssetField, message: string) {
  assetErrors[field] = message
  emit('error', message)
}

async function readImage(file: File | null | undefined, field: BrandAssetField) {
  if (!file) return
  assetErrors[field] = undefined
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_000_000) {
    rejectImage(field, t('saasSettings.editor.messages.invalidImage'))
    return
  }
  try {
    const source = await readAsDataUrl(file)
    const { width, height } = await readDimensions(source)
    if (width > 2400 || height > 2400) {
      rejectImage(field, t('saasSettings.editor.messages.imageTooLarge'))
      return
    }
    if (field.startsWith('mark') && (width < 64 || height < 64)) {
      rejectImage(field, t('saasSettings.editor.messages.markTooSmall'))
      return
    }
    state.value.branding[field] = source
  } catch {
    rejectImage(field, t('saasSettings.editor.messages.invalidImage'))
  }
}

function removeImage(field: BrandAssetField) {
  assetErrors[field] = undefined
  state.value.branding[field] = ''
}
</script>

<template>
  <div class="settings-grid">
    <UFormField name="branding.portalName" required :label="t('saasSettings.editor.fields.portalName')"><UInput v-model="state.branding.portalName" class="w-full" /></UFormField>
    <UFormField name="branding.tagline" :label="t('saasSettings.editor.fields.tagline')"><UInput v-model="state.branding.tagline" class="w-full" /></UFormField>
    <UFormField name="branding.supportEmail" :label="t('saasSettings.editor.fields.supportEmail')"><UInput v-model="state.branding.supportEmail" type="email" class="w-full" /></UFormField>
    <UFormField name="branding.supportUrl" :label="t('saasSettings.editor.fields.supportUrl')"><UInput v-model="state.branding.supportUrl" class="w-full" /></UFormField>
    <h2 class="section-heading">{{ t('saasSettings.editor.appearanceSection') }}</h2>
    <UFormField name="appearance.theme" required :label="t('saasSettings.editor.fields.theme')"><USelect v-model="state.appearance.theme" :items="[{ label: t('saasSettings.editor.themes.apex'), value: 'apex' }, { label: t('saasSettings.editor.themes.brutal'), value: 'brutal' }]" class="w-full" /></UFormField>
    <UFormField name="appearance.colorMode" required :label="t('saasSettings.editor.fields.colorMode')"><USelect v-model="state.appearance.colorMode" :items="[{ label: t('saasSettings.editor.colorModes.userChoice'), value: 'user-choice' }, { label: t('saasSettings.editor.colorModes.lightOnly'), value: 'light-only' }, { label: t('saasSettings.editor.colorModes.darkOnly'), value: 'dark-only' }]" class="w-full" /></UFormField>
    <UFormField v-if="state.appearance.colorMode !== 'dark-only'" name="appearance.primaryLight" required :label="t('saasSettings.editor.fields.primaryLight')"><input v-model="state.appearance.primaryLight" type="color" class="color-input"></UFormField>
    <UFormField v-if="state.appearance.colorMode !== 'light-only'" name="appearance.primaryDark" required :label="t('saasSettings.editor.fields.primaryDark')"><input v-model="state.appearance.primaryDark" type="color" class="color-input"></UFormField>
    <h2 class="section-heading">{{ t('saasSettings.editor.logoSection') }}</h2>
    <UFormField v-for="field in assetFields" :key="field" :name="`branding.${field}`" :label="t(`saasSettings.editor.fields.${field}`)" :description="t(`saasSettings.editor.assetDescriptions.${field}`)" :error="assetErrors[field]">
      <div class="asset-field"><img v-if="state.branding[field]" :src="state.branding[field]" alt="" ><UFileUpload variant="button" accept="image/png,image/jpeg,image/webp" reset :label="t('saasSettings.editor.actions.chooseImage')" @update:model-value="readImage($event, field)" /><UButton v-if="state.branding[field]" type="button" color="neutral" variant="ghost" size="xs" @click="removeImage(field)">{{ t('saasSettings.editor.actions.remove') }}</UButton></div>
    </UFormField>
  </div>
</template>

<style scoped>
.settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.25rem}.section-heading{grid-column:1/-1;margin-top:.75rem;padding-top:1.5rem;border-top:1px solid var(--ui-border);font-size:1rem;font-weight:700}.asset-field{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;min-height:4rem}.asset-field img{width:4rem;height:4rem;object-fit:contain;border:1px solid var(--ui-border);border-radius:.5rem}.color-input{width:100%;height:2.75rem;border:1px solid var(--ui-border);border-radius:.5rem;padding:.25rem;background:var(--ui-bg)}@media(max-width:768px){.settings-grid{grid-template-columns:1fr}}
</style>
