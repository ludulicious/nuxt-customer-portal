<script setup lang="ts">
const mt = useMediaText()
defineProps<{
  canCrop: boolean
}>()
const emit = defineEmits<{ crop: [] }>()
</script>

<template>
  <div class="image-crop-actions" role="group" :aria-label="mt('Crop actions')">
    <UButton
      class="image-crop-button"
      type="button"
      color="neutral"
      variant="outline"
      size="sm"
      icon="i-lucide-crop"
      :disabled="!canCrop"
      @click="emit('crop')"
      >{{ mt('Crop image') }}</UButton
    >
  </div>
</template>

<style scoped>
.image-crop-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-height: var(--control-height);
  gap: var(--space-3xs);
}
.image-crop-actions :deep(button) {
  min-height: 2.25rem;
  padding-inline: var(--space-2xs);
  font-size: var(--text-sm);
  white-space: nowrap;
}
.image-crop-actions :deep(button:enabled) {
  box-shadow: inset 0 0 0 var(--rule-thin) var(--color-accent);
}
</style>
