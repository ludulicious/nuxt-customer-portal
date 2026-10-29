<script setup lang="ts">
const props = defineProps<{ src: string; alt: string; contain?: boolean }>()
const api = useStoreMedia()
const url = ref(''),
  failed = ref(false),
  loading = ref(false)
const element = ref<HTMLElement | null>(null)
let controller: AbortController | undefined
async function load() {
  if (loading.value || url.value) {
    return
  }
  controller?.abort()
  const active = new AbortController()
  controller = active
  loading.value = true
  failed.value = false
  try {
    const blob = await api.preview(props.src, active.signal)
    if (!active.signal.aborted) {
      url.value = URL.createObjectURL(blob)
    }
  } catch {
    if (!active.signal.aborted) {
      failed.value = true
    }
  } finally {
    if (!active.signal.aborted) {
      loading.value = false
    }
  }
}
watch(
  () => props.src,
  () => {
    controller?.abort()
    if (url.value) {
      URL.revokeObjectURL(url.value)
    }
    url.value = ''
    loading.value = false
    void load()
  }
)
useIntersectionObserver(
  element,
  ([entry]) => {
    if (entry?.isIntersecting) {
      void load()
    }
  },
  { rootMargin: '200px' }
)
onBeforeUnmount(() => {
  controller?.abort()
  if (url.value) {
    URL.revokeObjectURL(url.value)
  }
})
const { t } = useI18n()
</script>

<template>
  <div ref="element" class="flex h-full w-full items-center justify-center bg-elevated">
    <img v-if="url" :src="url" :alt="alt" class="h-full w-full" :class="contain ? 'object-contain' : 'object-cover'" />
    <UButton
      v-else-if="failed"
      variant="ghost"
      color="neutral"
      icon="i-lucide-refresh-cw"
      :aria-label="t('products.media.retry')"
      @click.stop="load"
    />
    <UIcon
      v-else
      :name="loading ? 'i-lucide-loader-circle' : 'i-lucide-image'"
      :class="loading ? 'animate-spin' : ''"
      class="size-6 text-muted"
    />
  </div>
</template>
