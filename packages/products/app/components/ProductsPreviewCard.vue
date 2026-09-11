<script setup lang="ts">
import type { MarkdownStyle } from '../../shared/markdown-style'
import type { Product, ProductPreview, Locale } from '../../shared/types'

const props = defineProps<{
  markdownStyle?: MarkdownStyle
  product: Product
  copy: ProductPreview['content']['en']
  editing: boolean
  languages: { value: Locale; label: string }[]
}>()
const titleHtml = computed(() => {
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const subtitle = props.copy.subtitle?.trim()
  return `<h1>${escape(props.copy.title)}</h1>${subtitle ? `<p>${escape(subtitle)}</p>` : ''}`
})
const language = defineModel<Locale>('language', { required: true })
const emit = defineEmits<{ edit: [] }>()
const { t } = useI18n()
const api = useProducts()
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="font-semibold">{{ t('products.productInformation') }}</h2>
        <USelect
          v-if="languages.length > 1"
          v-model="language"
          :items="languages"
          :disabled="editing"
          size="sm"
          :aria-label="t('products.contentLanguage')"
          class="w-36"
        />
      </div>
    </template>
    <div class="space-y-6">
      <div v-if="product.imageIds.length" class="grid gap-3 sm:grid-cols-2">
        <img
          v-for="id in product.imageIds"
          :key="id"
          :src="api.previewImageUrl(product.id, id)"
          :alt="copy.title"
          class="w-full rounded-lg object-contain"
          loading="lazy"
        />
      </div>
      <div
        v-else
        class="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg bg-elevated/50 p-6 text-muted"
      >
        <UIcon name="i-lucide-image" class="size-8" />
        <p class="text-sm">{{ t('products.noImages') }}</p>
      </div>
      <slot v-if="editing" name="editor" />
      <template v-else>
        <div class="flex items-start justify-between gap-3">
          <ProductsMarkdown v-if="copy.title.trim()" :html="titleHtml" :theme="markdownStyle" class="min-w-0 flex-1" />
          <p v-else class="flex min-w-0 items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-languages" class="size-4 shrink-0" aria-hidden="true" />
            {{ t('products.noTranslation') }}
          </p>
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            class="shrink-0"
            :aria-label="t('products.editInformation')"
            :aria-expanded="editing"
            @click="emit('edit')"
          />
        </div>
        <div v-if="copy.summaryHtml" class="space-y-1">
          <h4 class="text-sm font-medium text-muted">{{ t('products.summary') }}</h4>
          <ProductsMarkdown :html="copy.summaryHtml" :theme="markdownStyle" />
        </div>
        <div class="space-y-1">
          <h4 class="text-sm font-medium text-muted">{{ t('products.description') }}</h4>
          <ProductsMarkdown v-if="copy.descriptionHtml" :html="copy.descriptionHtml" :theme="markdownStyle" />
          <p v-else class="flex min-w-0 items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-languages" class="size-4 shrink-0" aria-hidden="true" />
            {{ t('products.noDescription') }}
          </p>
        </div>
        <div v-if="product.nextSteps[language]?.trim()" class="space-y-1 border-t border-default pt-4 text-sm">
          <h4 class="font-medium text-muted">{{ t('products.nextSteps') }}</h4>
          <p class="whitespace-pre-wrap break-words">{{ product.nextSteps[language] }}</p>
        </div>
        <UButton
          v-if="product.videoUrl"
          :to="product.videoUrl"
          target="_blank"
          variant="outline"
          icon="i-lucide-play"
          >{{ t('products.watchPreview') }}</UButton
        >
      </template>
    </div>
  </UCard>
</template>
