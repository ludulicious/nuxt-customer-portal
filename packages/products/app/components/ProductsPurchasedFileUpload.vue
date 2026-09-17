<script setup lang="ts">
const props = defineProps<{
  disabled?: boolean
  upload: (file: File) => Promise<void>
}>()
const emit = defineEmits<{ 'update:uploading': [value: boolean] }>()
const { t } = useI18n()
const selection = ref<File[]>([])
const uploading = ref(false)
const progress = ref<{ current: number; total: number; name: string }>()

async function uploadSelection(files: File[] | File | null | undefined) {
  const selectedFiles = files ? (Array.isArray(files) ? files : [files]) : []
  if (!selectedFiles.length || uploading.value) {
    return
  }
  uploading.value = true
  emit('update:uploading', true)
  try {
    for (const [index, file] of selectedFiles.entries()) {
      progress.value = { current: index + 1, total: selectedFiles.length, name: file.name }
      await props.upload(file)
    }
  } finally {
    selection.value = []
    progress.value = undefined
    uploading.value = false
    emit('update:uploading', false)
  }
}
</script>

<template>
  <div class="space-y-2">
    <UFileUpload
      v-model="selection"
      multiple
      reset
      layout="list"
      position="inside"
      icon="i-lucide-cloud-upload"
      :label="t('products.dropPurchasedFiles')"
      :description="t('products.dropPurchasedFilesHelp')"
      :disabled="disabled || uploading"
      :file-image="false"
      accept=".pdf,.zip,.mp3,.m4a,.wav,.ogg,.mp4,.webm,.txt,.docx"
      class="w-full"
      @update:model-value="uploadSelection"
    />
    <div v-if="progress" class="space-y-2" role="status" aria-live="polite">
      <div class="flex items-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-loader-circle" class="size-4 shrink-0 animate-spin" />
        <span class="min-w-0 truncate">{{
          t('products.uploadingPurchasedFile', {
            current: progress.current,
            total: progress.total,
            name: progress.name
          })
        }}</span>
      </div>
      <UProgress animation="carousel" size="xs" />
    </div>
  </div>
</template>
