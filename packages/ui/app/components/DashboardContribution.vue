<script setup lang="ts">
const props = defineProps<{ component: string }>()
// Component resolution depends on the active Vue instance. Resolve during setup;
// deferring it through a computed getter runs outside that context during render
// and turns registered Nuxt components into empty custom elements.
const resolvedComponent = resolveComponent(props.component)
const componentMissing = typeof resolvedComponent === 'string'
</script>

<template>
  <NuxtErrorBoundary>
    <component :is="resolvedComponent" v-if="!componentMissing" />
    <UCard v-else>
      <p class="font-medium">{{ $t('dashboard.error.title') }}</p>
      <p class="mt-1 text-sm text-muted">{{ $t('dashboard.error.description') }}</p>
    </UCard>
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
