<script setup lang="ts">
withDefaults(
  defineProps<{
    icon: string
    title: string
    description: string
    actionLabel: string
    actionIcon?: string
    actionDisabled?: boolean
  }>(),
  {
    actionIcon: 'i-lucide-plus',
    actionDisabled: false
  }
)

defineEmits<{ action: [] }>()
</script>

<template>
  <UEmpty :icon="icon" :title="title" :description="description" variant="outline" size="lg" class="min-h-72">
    <template #actions>
      <UButton size="lg" :icon="actionIcon" :disabled="actionDisabled" @click="$emit('action')">
        {{ actionLabel }}
      </UButton>
    </template>
  </UEmpty>
</template>
