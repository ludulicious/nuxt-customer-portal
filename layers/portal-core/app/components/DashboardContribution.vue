<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{ component: string | Component }>()
</script>

<template>
  <NuxtErrorBoundary>
    <component :is="component" />
    <template #error="{ clearError }">
      <UCard>
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-medium">{{ $t('dashboard.error.title') }}</p>
            <p class="mt-1 text-sm text-muted">{{ $t('dashboard.error.description') }}</p>
          </div>
          <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" @click="clearError()">
            {{ $t('dashboard.error.retry') }}
          </UButton>
        </div>
      </UCard>
    </template>
  </NuxtErrorBoundary>
</template>
