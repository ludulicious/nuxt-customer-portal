<script setup lang="ts">
const props = withDefaults(defineProps<{
  name?: string
  tagline?: string
}>(), {
  name: 'Nuxt Customer Portal',
  tagline: 'Customer workspace'
})

const portalRuntimeSettings = useState<{ branding?: { portalName?: string, tagline?: string, markLight?: string, markDark?: string } } | null>('portal-runtime-settings', () => null)
const colorMode = useColorMode()
const runtimeName = computed(() => portalRuntimeSettings.value?.branding?.portalName || props.name)
const runtimeTagline = computed(() => portalRuntimeSettings.value?.branding?.tagline || props.tagline)
const runtimeMark = computed(() => {
  const branding = portalRuntimeSettings.value?.branding
  return colorMode.value === 'dark' ? (branding?.markDark || branding?.markLight || '') : (branding?.markLight || branding?.markDark || '')
})
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- Logo Icon -->
    <div class="relative">
      <img v-if="runtimeMark" :src="runtimeMark" alt="" class="size-10 rounded-lg object-contain">
      <svg v-else class="portal-logo-mark" width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
        {{ runtimeName }}
      </span>
      <span class="text-sm text-gray-600 dark:text-gray-400 leading-tight -mt-1">
        {{ runtimeTagline }}
      </span>
    </div>
  </div>
</template>
