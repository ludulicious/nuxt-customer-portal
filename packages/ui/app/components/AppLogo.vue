<script setup lang="ts">
withDefaults(defineProps<{
  name?: string
  tagline?: string
}>(), {
  name: 'Nuxt Customer Portal',
  tagline: 'Customer workspace'
})
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- Logo Icon -->
    <PortalLogoMark />

    <!-- Company Name -->
    <div class="flex flex-col">
      <span class="portal-wordmark text-2xl font-bold text-gray-900 dark:text-white leading-tight">
        {{ name }}
      </span>
      <span class="text-sm text-gray-600 dark:text-gray-400 leading-tight -mt-1">
        {{ tagline }}
      </span>
    </div>
  </div>
</template>
