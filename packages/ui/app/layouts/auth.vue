<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const bootstrap = useState<{ adminExists?: boolean, completed?: boolean } | null>('portal-bootstrap-state', () => null)
</script>

<template>
  <div class="auth-shell h-screen flex items-center justify-center px-4">
    <UButton
      icon="i-lucide-chevron-left"
      to="/"
      size="xl"
      color="neutral"
      variant="subtle"
      class="auth-back-button absolute left-8 top-8 rounded-full z-10"
    />

    <UPageCard
      variant="subtle"
      class="max-w-sm w-full"
    >
      <UAlert v-if="route.path === '/signup' && bootstrap && !bootstrap.adminExists" class="mb-5" color="info" variant="subtle" icon="i-lucide-shield-check" :title="t('saasSettings.bootstrap.title')" :description="t('saasSettings.bootstrap.description')" />
      <slot />
    </UPageCard>
  </div>
</template>
