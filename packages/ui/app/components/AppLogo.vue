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
    <div class="relative">
      <svg class="portal-logo-mark" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <!-- Background circle -->
        <circle cx="20" cy="20" r="20" fill="var(--portal-logo-surface)" />
        <!-- Building/facility icon -->
        <rect x="12" y="15" width="4" height="10" fill="var(--portal-logo-ink)" rx="1" />
        <rect x="18" y="12" width="4" height="13" fill="var(--portal-logo-ink)" rx="1" />
        <rect x="24" y="18" width="4" height="7" fill="var(--portal-logo-ink)" rx="1" />
        <!-- Roof/peak -->
        <path d="M10 15 L20 8 L30 15 L28 15 L20 10 L12 15 Z" fill="var(--portal-logo-ink)" />
        <!-- Door -->
        <rect x="18" y="20" width="2" height="5" fill="var(--portal-logo-surface)" />
      </svg>
    </div>

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
