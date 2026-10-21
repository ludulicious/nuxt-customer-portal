<script setup lang="ts">
import type { OrderPageCopy } from '../../shared/page-texts'
import type { PurchaseLink } from '../../shared/links'
import { purchaseMedia } from '../../shared/purchase-media'

const props = defineProps<{
  link: PurchaseLink
  copy?: Pick<OrderPageCopy, 'openLinkLabel' | 'previewVideoLabel' | 'externalVideoHelp' | 'externalPlaybackFailed'>
  preview?: boolean
}>()
const { t } = useI18n()
const media = computed(() => purchaseMedia(props.link.url))
const showingPreview = ref(false)
const playbackFailed = ref(false)
watch(
  () => props.link.url,
  () => {
    showingPreview.value = false
    playbackFailed.value = false
  }
)
</script>

<template>
  <article class="min-w-0 rounded-lg border border-default bg-default p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="min-w-0 font-semibold break-words">{{ link.name }}</h3>
      <UButton
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        referrerpolicy="no-referrer"
        external
        :disabled="preview"
        icon="i-lucide-external-link"
        variant="outline"
        size="sm"
        @click="preview && $event.preventDefault()"
        >{{ copy?.openLinkLabel || t('products.openPurchasedLink') }}</UButton
      >
    </div>
    <template v-if="media?.kind === 'embed'">
      <div v-if="showingPreview" class="mt-4 aspect-video overflow-hidden rounded-lg bg-black">
        <!-- Providers require a referrer; origin omits the private purchase path and token. -->
        <iframe
          :src="media.url"
          :title="link.name"
          class="h-full w-full"
          referrerpolicy="origin"
          sandbox="allow-scripts allow-same-origin allow-presentation"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowfullscreen
        />
      </div>
      <UButton
        v-else
        class="mt-4"
        icon="i-lucide-circle-play"
        variant="soft"
        :disabled="preview"
        @click="showingPreview = true"
        >{{ copy?.previewVideoLabel || t('products.previewPurchasedVideo') }}</UButton
      >
      <p class="mt-2 text-xs text-muted">{{ copy?.externalVideoHelp || t('products.externalVideoHelp') }}</p>
    </template>
    <audio
      v-else-if="media?.kind === 'audio'"
      :src="preview ? undefined : media.url"
      controls
      preload="none"
      class="mt-4 w-full"
      @error="playbackFailed = true"
    />
    <video
      v-else-if="media?.kind === 'video'"
      :src="preview ? undefined : media.url"
      controls
      preload="none"
      class="mt-4 w-full rounded-lg"
      @error="playbackFailed = true"
    />
    <p v-if="playbackFailed" role="status" class="mt-3 text-sm text-muted">
      {{ copy?.externalPlaybackFailed || t('products.externalPlaybackFailed') }}
    </p>
  </article>
</template>
