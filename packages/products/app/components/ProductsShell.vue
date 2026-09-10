<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <section class="h-full min-h-0 overflow-y-auto p-4 sm:p-6">
    <div class="mx-auto max-w-6xl space-y-6">
      <header class="flex items-start justify-between gap-4">
        <div>
          <h1 class="flex items-center gap-3 text-2xl font-semibold">
            <UIcon name="i-lucide-shopping-bag" />{{ title }}
          </h1>
          <p v-if="subtitle" class="mt-2 text-muted">{{ subtitle }}</p>
        </div>
        <slot name="actions" />
      </header>
      <slot />
    </div>
  </section>
</template>
