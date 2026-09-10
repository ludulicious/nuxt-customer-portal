<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <section class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto flex max-w-[1440px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <slot name="back" />
        <header class="flex items-center justify-between gap-3 border-b border-default pb-4 sm:items-end">
          <div class="flex min-w-0 gap-3">
            <UIcon name="i-lucide-shopping-bag" class="mt-1 size-6 shrink-0 text-primary" />
            <div class="min-w-0">
              <h1 class="text-2xl font-semibold">{{ title }}</h1>
              <p v-if="subtitle" class="hidden text-sm text-muted sm:block">{{ subtitle }}</p>
            </div>
          </div>
          <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1"><slot name="actions" /></div>
        </header>
        <slot />
      </div>
    </section>
    <footer
      v-if="$slots.footer"
      class="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-3 border-t border-default px-4 pt-3 text-sm text-muted sm:px-6 lg:px-8"
    >
      <slot name="footer" />
    </footer>
  </div>
</template>
