<script setup lang="ts">
import type { PurchaseDownload } from '../../shared/downloads'
import type { PurchaseLink } from '../../shared/links'
import type { OrderPageCopy } from '../../shared/page-texts'

defineProps<{
  files: PurchaseDownload[]
  links?: PurchaseLink[]
  copy?: OrderPageCopy
  preview?: boolean
}>()
</script>

<template>
  <div class="purchase-content">
    <div v-if="files.length" class="purchase-files">
      <ProductsPurchasedFileCard
        v-for="file in files"
        :key="file.id"
        :file="{ ...file, content_type: file.content_type || 'application/octet-stream', size: file.size }"
        :source="file.url"
        :inline-source="file.previewUrl"
        :copy="copy"
        :preview="preview"
      />
    </div>
    <ProductsPurchasedLinkCard
      v-for="link in links || []"
      :key="link.id"
      :link="link"
      :copy="copy"
      :preview="preview"
    />
  </div>
</template>

<style scoped>
.purchase-content,
.purchase-files {
  display: grid;
  align-items: start;
  gap: 16px;
  min-width: 0;
}
.purchase-content {
  margin-top: 16px;
}
</style>
