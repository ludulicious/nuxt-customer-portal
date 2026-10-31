<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
const { t } = useI18n()
</script>

<template>
  <nav
    :aria-label="t('portalLegal.navigation')"
    class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
    :class="collapsed ? 'justify-center' : 'px-2'"
  >
    <NuxtLink
      v-for="link in [
        { to: '/terms', label: t('portalLegal.terms'), icon: 'i-lucide-file-text' },
        { to: '/privacy', label: t('portalLegal.privacy'), icon: 'i-lucide-shield' }
      ]"
      :key="link.to"
      :to="link.to"
      :title="collapsed ? link.label : undefined"
      class="rounded hover:text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
      :class="collapsed ? 'flex min-h-8 min-w-8 items-center justify-center' : 'py-2'"
      @click="emit('navigate')"
    >
      <UIcon v-if="collapsed" :name="link.icon" class="size-4" aria-hidden="true" />
      <span :class="{ 'sr-only': collapsed }">{{ link.label }}</span>
    </NuxtLink>
  </nav>
</template>
