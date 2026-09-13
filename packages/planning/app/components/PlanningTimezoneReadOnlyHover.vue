<script setup lang="ts">
const props = defineProps<{ readonly: boolean; userTimezone: string; start?: string; end?: string }>()
const emit = defineEmits<{ switchTimezone: [] }>()
const { t, locale } = useI18n()
const popupId = useId()
const activePopup = useState<string | null>('planning.activeTimezoneHover', () => null)
const isOpen = computed({
  get: () => activePopup.value === popupId,
  set: (open: boolean) => {
    if (open) {
      activePopup.value = popupId
    } else if (activePopup.value === popupId) {
      activePopup.value = null
    }
  }
})
watch(
  () => props.readonly,
  (readonly) => {
    if (!readonly) {
      isOpen.value = false
    }
  }
)
onBeforeUnmount(() => {
  isOpen.value = false
})
const ownTimezoneRange = computed(() =>
  props.start && props.end
    ? new Intl.DateTimeFormat(locale.value, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: props.userTimezone
      }).formatRange(new Date(props.start), new Date(props.end))
    : ''
)
</script>

<template>
  <span class="block">
    <UPopover
      v-if="readonly"
      v-model:open="isOpen"
      mode="hover"
      :content="{ side: 'top' }"
      :ui="{ content: 'bg-elevated ring-1 ring-accented shadow-xl' }"
    >
      <span class="block h-full w-full" tabindex="0"><slot /></span>
      <template #content>
        <div class="w-72 space-y-3 rounded-lg border border-accented bg-elevated p-4 text-default">
          <div v-if="ownTimezoneRange" class="space-y-1 border-b border-accented pb-3">
            <p class="text-xs text-muted">{{ userTimezone.replaceAll('_', ' ') }}</p>
            <p class="text-sm font-semibold">{{ ownTimezoneRange }}</p>
          </div>
          <p class="text-sm">{{ t('planning.timezoneReadOnly', { timezone: userTimezone.replaceAll('_', ' ') }) }}</p>
          <UButton size="sm" variant="soft" @click="emit('switchTimezone')">{{
            t('planning.switchToUserTimezone')
          }}</UButton>
        </div>
      </template>
    </UPopover>
    <slot v-else />
  </span>
</template>
