<script setup lang="ts">
const props = defineProps<{
  file: { id: string; name: string; content_type: string; size: number }
  source: string
}>()
const { t, locale } = useI18n()

const extension = computed(() => {
  const value = props.file.name.match(/\.([a-z0-9]{1,8})$/i)?.[1]
  if (value) {
    return value.toUpperCase()
  }
  const subtype = props.file.content_type.split('/')[1]?.split(/[+.]/)[0]
  return subtype ? subtype.toUpperCase() : 'FILE'
})
const icon = computed(() => {
  const type = props.file.content_type
  if (type === 'application/pdf' || extension.value === 'PDF') {
    return 'i-lucide-file-text'
  }
  if (type.startsWith('image/')) {
    return 'i-lucide-file-image'
  }
  if (type.startsWith('audio/')) {
    return 'i-lucide-file-audio'
  }
  if (type.startsWith('video/')) {
    return 'i-lucide-file-video'
  }
  if (type.includes('spreadsheet') || ['CSV', 'XLS', 'XLSX', 'ODS'].includes(extension.value)) {
    return 'i-lucide-file-spreadsheet'
  }
  if (
    type.includes('zip') ||
    type.includes('compressed') ||
    ['ZIP', 'RAR', '7Z', 'TAR', 'GZ'].includes(extension.value)
  ) {
    return 'i-lucide-file-archive'
  }
  if (
    type.includes('json') ||
    type.includes('xml') ||
    ['JSON', 'XML', 'HTML', 'CSS', 'JS', 'TS'].includes(extension.value)
  ) {
    return 'i-lucide-file-code'
  }
  return 'i-lucide-file'
})
const size = computed(() => {
  if (props.file.size < 1024) {
    return `${props.file.size} B`
  }
  const units = ['KB', 'MB', 'GB']
  let value = props.file.size / 1024
  let unit = units[0]!
  for (let index = 1; value >= 1024 && index < units.length; index++) {
    value /= 1024
    unit = units[index]!
  }
  return `${new Intl.NumberFormat(locale.value, { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value)} ${unit}`
})
</script>

<template>
  <article class="flex min-w-0 flex-col rounded-lg border border-default bg-default p-4">
    <div class="flex min-w-0 items-start gap-4">
      <div
        class="relative flex h-28 w-22 shrink-0 items-center justify-center overflow-hidden rounded-md border border-default bg-elevated shadow-xs"
        aria-hidden="true"
      >
        <span
          class="absolute top-0 right-0 size-5 border-b border-l border-default bg-default [clip-path:polygon(100%_0,100%_100%,0_0)]"
        />
        <UIcon :name="icon" class="size-10 text-primary" />
        <span
          class="absolute right-2 bottom-2 left-2 truncate rounded bg-default px-1.5 py-0.5 text-center text-[10px] font-semibold tracking-wider text-muted"
        >
          {{ extension }}
        </span>
      </div>
      <div class="min-w-0 flex-1 pt-1">
        <h3 class="line-clamp-3 text-sm font-semibold" :title="file.name">{{ file.name }}</h3>
        <p class="mt-1 text-xs text-muted">{{ size }}</p>
        <UButton
          :href="`${source}?download=1`"
          external
          variant="outline"
          icon="i-lucide-download"
          size="xs"
          class="mt-3"
        >
          {{ t('products.download') }}
        </UButton>
      </div>
    </div>
    <audio v-if="file.content_type.startsWith('audio/')" :src="source" controls preload="none" class="mt-4 w-full" />
    <video
      v-else-if="file.content_type.startsWith('video/')"
      :src="source"
      controls
      preload="none"
      class="mt-4 w-full rounded-md"
    />
  </article>
</template>
