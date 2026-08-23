<script setup lang="ts">
const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
const settings = useState<{ branding?: { portalName?: string, markLight?: string, markDark?: string, logoLight?: string, logoDark?: string } } | null>('portal-runtime-settings', () => null)
const colorMode = useColorMode()
const source = computed(() => {
  const branding = settings.value?.branding
  if (!branding) return ''
  const kind = props.compact ? 'mark' : 'logo'
  return colorMode.value === 'dark' ? (branding[`${kind}Dark`] || branding[`${kind}Light`] || '') : (branding[`${kind}Light`] || branding[`${kind}Dark`] || '')
})
</script>

<template><img v-if="source" :src="source" :alt="compact ? '' : settings?.branding?.portalName" :class="compact ? 'size-10 rounded-lg object-contain' : 'h-12 max-w-64 object-contain'" ><strong v-else class="text-xl">{{ settings?.branding?.portalName || 'Customer Portal' }}</strong></template>
