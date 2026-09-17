<script setup lang="ts">
const props = defineProps<{ userTimezone: string; disabled?: boolean }>()
const model = defineModel<string>({ required: true })
const { t } = useI18n()
const timezoneIds = Intl.supportedValuesOf('timeZone')
const recentTimezones = useState<string[]>('planning.recentTimezones', () => [])
const timezoneStorageKey = 'planning.recentTimezones'
type TimezoneMenuItem = {
  type?: 'label' | 'separator'
  label?: string
  value?: string
  favorite?: boolean
}
function normalizeTimezones(values: unknown): string[] {
  return Array.isArray(values)
    ? [
        ...new Set(
          values.filter(
            (value): value is string =>
              typeof value === 'string' && timezoneIds.includes(value) && value !== props.userTimezone
          )
        )
      ]
    : []
}
function removeRecentTimezone(timezone: string) {
  if (timezone === model.value || timezone === props.userTimezone) {
    return
  }
  recentTimezones.value = recentTimezones.value.filter((value) => value !== timezone)
  persistRecentTimezones()
}
function persistRecentTimezones() {
  try {
    localStorage.setItem(timezoneStorageKey, JSON.stringify(recentTimezones.value))
  } catch {
    /* Preferences remain available when storage is blocked. */
  }
}
function rememberTimezone(timezone: string) {
  recentTimezones.value = normalizeTimezones(
    timezone === props.userTimezone ? recentTimezones.value : [timezone, ...recentTimezones.value]
  )
  persistRecentTimezones()
}
const timezoneOptions = computed<TimezoneMenuItem[]>(() => {
  const favorites = [props.userTimezone, ...normalizeTimezones(recentTimezones.value).slice(0, 5)]
  const item = (value: string, favorite = false) => ({ favorite, value, label: value.replaceAll('_', ' ') })
  return [
    { type: 'label' as const, label: t('planning.timezoneFavorites') },
    ...favorites.map((value) => item(value, true)),
    { type: 'separator' as const },
    { type: 'label' as const, label: t('planning.allTimezones') },
    ...timezoneIds.filter((value) => !favorites.includes(value)).map((value) => item(value))
  ]
})
onMounted(() => {
  try {
    recentTimezones.value = normalizeTimezones(JSON.parse(localStorage.getItem(timezoneStorageKey) || '[]'))
  } catch {
    recentTimezones.value = []
  }
})
watch(
  () => props.userTimezone,
  () => rememberTimezone(props.userTimezone)
)
const selectedTimezone = computed({
  get: () => model.value,
  set: (timezone: string) => {
    rememberTimezone(timezone)
    model.value = timezone
  }
})
</script>

<template>
  <USelectMenu
    v-model="selectedTimezone"
    :items="timezoneOptions"
    value-key="value"
    :aria-label="t('planning.calendarTimezone')"
    class="w-56"
    :disabled="disabled"
    :ui="{ item: 'group' }"
  >
    <template #item-trailing="{ item }"
      ><UButton
        v-if="item.value && item.favorite && item.value !== userTimezone && item.value !== model"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        class="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        :aria-label="t('planning.removeTimezoneFavorite', { timezone: item.label })"
        @pointerdown.stop.prevent
        @click.stop.prevent="removeRecentTimezone(item.value)"
        @keydown.stop
    /></template>
  </USelectMenu>
</template>
