<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { z } from 'zod'
import type { MediaVariantPreset } from '../../shared/media-variants'
import ProductsMediaImageEditor, { type ImageSubmission } from './ProductsMediaImageEditor.vue'

const mt = useMediaText()
const { t } = useI18n()
const sharedSchema = useProductFormSchema(
  z.object({
    categories: z.array(z.string().trim().min(1).max(100)).max(50),
    credit: z.string().trim().max(500),
    visible: z.boolean()
  })
)

const props = defineProps<{
  formats: string[]
  maximum: number
  categories: string[]
  busy: boolean
  aspectRatio?: number | null
  aspectRatioLabel?: string
  presets?: MediaVariantPreset[]
  thumbnailAspectRatio?: number | null
  thumbnailAspectRatioLabel?: string
  configurationError?: string
  saveImage: (value: ImageSubmission) => Promise<boolean>
}>()
const emit = defineEmits<{ back: []; dirty: [boolean]; working: [boolean] }>()
interface Entry {
  id: number
  file: File
  preview: string
  saved: boolean
}
let nextId = 0
const files = ref<File[]>([])
const entries = ref<Entry[]>([])
const rejected = ref<string[]>([])
const reviewing = ref(false)
const selected = ref(0)
const working = ref(false)
const editor = ref<{ savePending: () => Promise<boolean> }>()
const sharedForm = ref<{ validate: () => Promise<unknown> }>()
const shared = ref({ categories: [] as string[], credit: '', visible: true })
const current = computed(() => entries.value.find((entry) => entry.id === selected.value))
const remaining = computed(() => entries.value.filter((entry) => !entry.saved))
const savedCount = computed(() => entries.value.filter((entry) => entry.saved).length)
const locked = computed(() => props.busy || working.value)
watch(
  () => remaining.value.length > 0,
  (dirty) => emit('dirty', dirty),
  { immediate: true }
)
watch(files, (values) => {
  if (locked.value || reviewing.value) {
    return
  }
  rejected.value = []
  for (const file of values || []) {
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !props.formats.includes(extension)) {
      rejected.value.push(
        t('products.media.rejectedFormat', { name: file.name, formats: props.formats.join(', ').toUpperCase() })
      )
      continue
    }
    if (file.size > props.maximum) {
      rejected.value.push(t('products.media.rejectedSize', { name: file.name, size: props.maximum / 1024 / 1024 }))
      continue
    }
    if (
      entries.value.some(
        (entry) =>
          entry.file.name === file.name &&
          entry.file.size === file.size &&
          entry.file.lastModified === file.lastModified
      )
    ) {
      continue
    }
    entries.value.push({
      id: ++nextId,
      file,
      preview: URL.createObjectURL(file),
      saved: false
    })
  }
})
function remove(entry: Entry) {
  files.value = files.value.filter((file) => file !== entry.file)
  URL.revokeObjectURL(entry.preview)
  entries.value = entries.value.filter((item) => item.id !== entry.id)
}
async function startReview() {
  try {
    await sharedForm.value?.validate()
  } catch {
    return
  }
  if (!remaining.value.length || locked.value) {
    return
  }
  selected.value = remaining.value[0]!.id
  reviewing.value = true
}
function changeWorking(value: boolean) {
  working.value = value
  emit('working', value)
}
async function saveEntry(entry: Entry, value: ImageSubmission) {
  const saved = await props.saveImage(value)
  if (!saved) {
    return false
  }
  entry.saved = true
  if (remaining.value.length) {
    selected.value = remaining.value[0]!.id
  }
  return true
}
async function savePending() {
  if (!remaining.value.length) {
    return true
  }
  if (!reviewing.value) {
    await startReview()
    return false
  }
  if (current.value?.saved) {
    return false
  }
  await editor.value?.savePending()
  return remaining.value.length === 0
}
onBeforeUnmount(() => {
  entries.value.forEach((entry) => URL.revokeObjectURL(entry.preview))
})
defineExpose({ savePending })
</script>

<template>
  <section class="media-batch-upload">
    <template v-if="!reviewing">
      <div class="batch-heading">
        <UButton icon="i-lucide-arrow-left" color="neutral" variant="link" :disabled="locked" @click="emit('back')">{{
          mt('Back to library')
        }}</UButton>
        <UButton :disabled="!entries.length || locked" trailing-icon="i-lucide-arrow-right" @click="startReview">{{
          t('products.media.reviewCount', { count: entries.length })
        }}</UButton>
      </div>
      <div class="batch-scroll">
        <h1>{{ mt('Upload multiple images') }}</h1>
        <p class="batch-help">
          {{ mt('Choose your images, set any shared details, then review each image before saving.') }}
        </p>
        <UFileUpload
          v-model="files"
          :multiple="true"
          :preview="false"
          :accept="formats.map((format) => '.' + format).join(',')"
          :disabled="locked"
          icon="i-lucide-images"
          :label="mt('Drop images here or choose files')"
          :description="
            t('products.media.fileLimit', { formats: formats.join(', ').toUpperCase(), size: maximum / 1024 / 1024 })
          "
        />
        <UAlert
          v-if="rejected.length"
          color="error"
          :title="mt('Some files could not be added')"
          :description="rejected.join('\n')"
          class="mt-4"
        />
        <ul v-if="entries.length" class="batch-files" :aria-label="mt('Selected images')">
          <li v-for="entry in entries" :key="entry.id">
            <img :src="entry.preview" alt="" />
            <span>{{ entry.file.name }}</span>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              :aria-label="t('products.media.removeNamed', { name: entry.file.name })"
              :disabled="locked"
              @click="remove(entry)"
            />
          </li>
        </ul>
        <UForm ref="sharedForm" :schema="sharedSchema" :state="shared" novalidate
          ><UCard class="mt-6" :ui="{ body: 'space-y-5' }">
            <template #header
              ><h2>{{ mt('Shared details (optional)') }}</h2>
              <p class="batch-help">
                {{ mt('Applied to every selected image. You can change them individually during review.') }}
              </p></template
            >
            <UFormField :label="mt('Categories')" name="categories" :description="mt('Press Enter to add a category.')"
              ><UInputTags v-model="shared.categories" :disabled="locked" class="w-full" />
              <div class="batch-suggestions">
                <UButton
                  v-for="category in categories.filter((category) => !shared.categories.includes(category))"
                  :key="category"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  :disabled="locked"
                  @click="shared.categories.push(category)"
                  >{{ category }}</UButton
                >
              </div>
            </UFormField>
            <UFormField :label="mt('Photo credit')" name="credit"
              ><UInput
                v-model="shared.credit"
                :placeholder="mt('Photographer or organisation')"
                :disabled="locked"
                class="w-full"
            /></UFormField>
            <USwitch v-model="shared.visible" :label="mt('Visible on website')" :disabled="locked" /> </UCard
        ></UForm>
      </div>
    </template>
    <template v-else>
      <div class="batch-progress" role="status">
        {{ t('products.media.savedCount', { saved: savedCount, count: entries.length }) }}
      </div>
      <p class="batch-help">
        {{
          mt(
            'Titles come from filenames. Add a description for each image and check its crop. Each save adds that image to your library.'
          )
        }}
      </p>
      <nav class="batch-queue" :aria-label="mt('Images to review')">
        <UButton
          v-for="(entry, index) in entries"
          :key="entry.id"
          :color="selected === entry.id ? 'primary' : 'neutral'"
          :variant="selected === entry.id ? 'soft' : 'ghost'"
          :icon="entry.saved ? 'i-lucide-circle-check' : 'i-lucide-image'"
          :aria-current="selected === entry.id ? 'step' : undefined"
          :disabled="locked"
          @click="selected = entry.id"
          >{{ index + 1 }}. {{ entry.file.name }}{{ entry.saved ? ' · ' + t('products.media.saved') : '' }}</UButton
        >
      </nav>
      <KeepAlive>
        <ProductsMediaImageEditor
          v-if="current && !current.saved"
          :key="current.id"
          ref="editor"
          :initial-file="current.file"
          :initial-details="shared"
          :formats="formats"
          :maximum="maximum"
          :categories="categories"
          :busy="busy"
          :presets="presets"
          :configuration-error="configurationError"
          :save-label="remaining.length > 1 ? mt('Save and next') : mt('Save image')"
          :save-image="(value) => saveEntry(current!, value)"
          @back="emit('back')"
          @working="changeWorking"
        />
      </KeepAlive>
      <div v-if="current?.saved" class="batch-complete">
        <UIcon name="i-lucide-circle-check" />
        <h2>{{ remaining.length ? t('products.media.imageSaved') : t('products.media.allSaved') }}</h2>
        <p>
          {{ remaining.length ? t('products.media.chooseAnother') : t('products.media.imagesInLibrary') }}
        </p>
        <UButton v-if="remaining.length" @click="selected = remaining[0]!.id">{{ mt('Continue reviewing') }}</UButton>
        <UButton v-else icon="i-lucide-arrow-left" @click="emit('back')">{{ mt('Back to library') }}</UButton>
      </div>
    </template>
  </section>
</template>

<style scoped>
.media-batch-upload {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  gap: var(--space-sm);
}
.batch-heading {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-sm);
}
.batch-scroll {
  overflow-y: auto;
  min-height: 0;
  padding: var(--space-xs);
}
.batch-help {
  color: var(--color-ink-muted);
  font-size: var(--text-sm);
  margin-block: var(--space-xs) var(--space-md);
}
.batch-files {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  list-style: none;
  gap: var(--space-sm);
  padding: 0;
  margin-top: var(--space-md);
}
.batch-files li {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  border: 1px solid var(--color-rule);
  border-radius: var(--radius-card);
  padding: var(--space-xs);
  min-width: 0;
}
.batch-files img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--radius-card);
}
.batch-files span {
  flex: 1;
  overflow-wrap: anywhere;
  min-width: 0;
}
.batch-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
  margin-top: var(--space-xs);
}
.batch-progress {
  font-weight: 600;
}
.batch-queue {
  display: flex;
  overflow-x: auto;
  gap: var(--space-xs);
  flex-shrink: 0;
  padding-bottom: var(--space-xs);
}
.batch-queue :deep(button) {
  flex-shrink: 0;
  max-width: 80vw;
  white-space: normal;
  overflow-wrap: anywhere;
}
.media-batch-upload > .media-image-editor {
  flex: 1;
  min-height: 0;
  width: 100%;
}
.batch-complete {
  text-align: center;
  padding: var(--space-2xl);
}
.batch-complete p {
  margin-bottom: var(--space-md);
  color: var(--color-ink-muted);
}
</style>
