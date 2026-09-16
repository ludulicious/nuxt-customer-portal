<script setup lang="ts">
const props = defineProps<{
  readonly: boolean
  userTimezone: string
  timezone?: string
  title?: string
  icon?: string
  allDay?: boolean
  customerName?: string
  email?: string
  country?: string
  start?: string
  end?: string
}>()
const emit = defineEmits<{ switchTimezone: [] }>()
const { t, locale } = useI18n()
const { appointmentRange } = usePlanningTimeDisplay()
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
  props.start && props.end ? appointmentRange(props.start, props.end, props.userTimezone) : ''
)
const viewedTimezoneRange = computed(() =>
  props.allDay
    ? t('planning.allDay')
    : props.start && props.end && props.timezone
      ? appointmentRange(props.start, props.end, props.timezone)
      : ''
)
const hasPopover = computed(() => props.readonly || Boolean(props.title))
const timezoneName = (timezone: string) => timezone.replaceAll('_', ' ')
const countryName = computed(() => {
  if (!props.country) return ''
  try {
    return new Intl.DisplayNames([locale.value], { type: 'region' }).of(props.country.toUpperCase()) || props.country
  } catch {
    return props.country
  }
})
</script>

<template>
  <span class="block">
    <UPopover
      v-if="hasPopover"
      v-model:open="isOpen"
      mode="hover"
      :content="{ side: 'top' }"
      :ui="{ content: 'bg-transparent p-0 ring-0 shadow-none' }"
    >
      <span class="block h-full w-full" tabindex="0"><slot /></span>
      <template #content>
        <div class="w-72 space-y-3 rounded-lg border border-accented bg-elevated p-4 text-default shadow-xl">
          <div v-if="title || viewedTimezoneRange" class="space-y-2 border-b border-accented pb-3">
            <p v-if="title" class="flex items-center gap-2 text-sm font-semibold">
              <UIcon :name="icon || 'i-lucide-calendar-check-2'" class="size-4 shrink-0 text-info" />
              {{ title }}
            </p>
            <div v-if="viewedTimezoneRange">
              <p class="text-xs text-muted">{{ timezoneName(timezone || userTimezone) }}</p>
              <p class="text-sm font-semibold">{{ viewedTimezoneRange }}</p>
            </div>
          </div>
          <div v-if="customerName || email || countryName" class="space-y-2 border-b border-accented pb-3 text-sm">
            <p v-if="customerName" class="flex items-center gap-2">
              <UIcon name="i-lucide-user" class="size-4 shrink-0 text-muted" />
              <span>{{ customerName }}</span>
            </p>
            <p v-if="email" class="flex items-center gap-2">
              <UIcon name="i-lucide-mail" class="size-4 shrink-0 text-muted" />
              <span class="break-all">{{ email }}</span>
            </p>
            <p v-if="countryName" class="flex items-center gap-2">
              <UIcon name="i-lucide-map-pin" class="size-4 shrink-0 text-muted" />
              <span>{{ countryName }}</span>
            </p>
          </div>
          <div
            v-if="readonly && ownTimezoneRange && userTimezone !== timezone"
            class="space-y-1 border-b border-accented pb-3"
          >
            <p class="text-xs text-muted">{{ timezoneName(userTimezone) }}</p>
            <p class="text-sm font-semibold">{{ ownTimezoneRange }}</p>
          </div>
          <template v-if="readonly">
            <p class="text-sm">{{ t('planning.timezoneReadOnly', { timezone: timezoneName(userTimezone) }) }}</p>
            <UButton size="sm" variant="soft" @click="emit('switchTimezone')">{{
              t('planning.switchToUserTimezone')
            }}</UButton>
          </template>
        </div>
      </template>
    </UPopover>
    <slot v-else />
  </span>
</template>
