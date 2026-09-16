<script setup lang="ts">
const props = defineProps<{
  readonly: boolean
  editable?: boolean
  userTimezone: string
  timezone?: string
  title?: string
  icon?: string
  allDay?: boolean
  customerName?: string
  email?: string
  country?: string
  customerTimezone?: string
  start?: string
  end?: string
}>()
const emit = defineEmits<{ switchTimezone: []; edit: [] }>()
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
const customerTimezoneRange = computed(() =>
  props.start && props.end && props.customerTimezone && props.customerTimezone !== props.timezone
    ? appointmentRange(props.start, props.end, props.customerTimezone)
    : ''
)
const hasPopover = computed(() => props.readonly || Boolean(props.title))
const timezoneName = (timezone: string) => timezone.replaceAll('_', ' ')
const countryName = computed(() => {
  if (!props.country) {
    return ''
  }
  try {
    return new Intl.DisplayNames([locale.value], { type: 'region' }).of(props.country.toUpperCase()) || props.country
  } catch {
    return props.country
  }
})
function edit() {
  isOpen.value = false
  emit('edit')
}
</script>

<template>
  <span class="block">
    <UPopover
      v-if="hasPopover"
      v-model:open="isOpen"
      mode="hover"
      :open-delay="300"
      :close-delay="500"
      :content="{ side: 'top', sideOffset: 14, collisionPadding: 16 }"
      :ui="{
        content:
          'planning-calendar-tooltip w-72 space-y-3 rounded-md border border-accented bg-default p-4 text-default shadow-xl ring-0'
      }"
    >
      <span class="block h-full w-full" tabindex="0"><slot /></span>
      <template #content>
        <div class="space-y-3">
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
          <div
            v-if="customerName || email || countryName || customerTimezoneRange"
            class="space-y-2 border-b border-accented pb-3 text-sm"
          >
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
            <div v-if="customerTimezoneRange" class="flex items-start gap-2">
              <UIcon name="i-lucide-clock-3" class="mt-0.5 size-4 shrink-0 text-muted" />
              <div>
                <p class="text-xs text-muted">{{ timezoneName(customerTimezone || '') }}</p>
                <p class="font-medium">{{ customerTimezoneRange }}</p>
              </div>
            </div>
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
          <UButton v-else-if="editable" icon="i-lucide-pencil" size="sm" variant="soft" @click="edit">
            {{ t('planning.editAvailability') }}
          </UButton>
        </div>
      </template>
    </UPopover>
    <slot v-else />
  </span>
</template>

<style>
.planning-calendar-tooltip::after {
  position: absolute;
  left: 50%;
  width: 12px;
  height: 12px;
  content: '';
  background: var(--ui-bg);
  transform: translateX(-50%) rotate(45deg);
}

.planning-calendar-tooltip[data-side='top']::after {
  bottom: -7px;
  border-right: 1px solid var(--ui-border-accented);
  border-bottom: 1px solid var(--ui-border-accented);
}

.planning-calendar-tooltip[data-side='bottom']::after {
  top: -7px;
  border-top: 1px solid var(--ui-border-accented);
  border-left: 1px solid var(--ui-border-accented);
}
</style>
