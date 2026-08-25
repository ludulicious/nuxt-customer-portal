<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <USeparator class="h-px" />

  <UFooter
    class="portal-footer"
    :ui="{ top: 'border-b border-default', container: 'w-full max-w-none px-0 sm:px-0 lg:px-0' }"
  >
    <template #left>
      <p class="text-muted text-sm">© {{ new Date().getFullYear() }}. {{ t('footer.copyright') }}</p>
    </template>
    <template #right>
      <nav class="flex gap-4 text-sm" aria-label="Legal">
        <NuxtLink class="text-muted hover:text-highlighted" to="/terms">Terms</NuxtLink
        ><NuxtLink class="text-muted hover:text-highlighted" to="/privacy">Privacy</NuxtLink>
      </nav>
    </template>
  </UFooter>
</template>
