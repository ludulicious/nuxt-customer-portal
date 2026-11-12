<script setup lang="ts">
import { shiftReviewMonth } from '../../shared/client-review-month'

const month = defineModel<string>({ required: true })
const { t, locale } = useI18n()
const open = ref(false)
const year = ref(Number(month.value.slice(0, 4)))
const label = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(`${month.value}-01T00:00:00Z`))
)
const months = computed(() =>
  Array.from({ length: 12 }, (_, index) => {
    const value = `${String(year.value).padStart(4, '0')}-${String(index + 1).padStart(2, '0')}`
    const date = new Date(`${value}-01T00:00:00Z`)
    return {
      value,
      label: new Intl.DateTimeFormat(locale.value, { month: 'short', timeZone: 'UTC' }).format(date),
      accessibleLabel: new Intl.DateTimeFormat(locale.value, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC'
      }).format(date)
    }
  })
)
watch(open, (value) => {
  if (value) {
    year.value = Number(month.value.slice(0, 4))
  }
})
const select = (value: string) => {
  month.value = value
  open.value = false
}
</script>

<template>
  <div class="flex items-center gap-1">
    <UButton
      icon="i-lucide-chevron-left"
      color="neutral"
      variant="outline"
      :disabled="month <= '0001-01'"
      :aria-label="t('features.timesheets.reviewPeriods.previousMonth')"
      @click="month = shiftReviewMonth(month, -1)"
    />
    <div class="min-w-0 flex-1">
      <UPopover v-model:open="open">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-calendar-days"
          trailing-icon="i-lucide-chevron-down"
          class="w-full justify-between whitespace-nowrap"
          :label="label"
          :aria-label="`${t('features.timesheets.reviewPeriods.month')}: ${label}`"
        />
        <template #content>
          <div class="w-64 space-y-3 p-3">
            <div class="flex items-center justify-between gap-2">
              <UButton
                icon="i-lucide-chevron-left"
                color="neutral"
                variant="ghost"
                :disabled="year <= 1"
                :aria-label="t('features.timesheets.reviewPeriods.previousYear')"
                @click="year--"
              />
              <span class="font-semibold tabular-nums" aria-live="polite">{{ year }}</span>
              <UButton
                icon="i-lucide-chevron-right"
                color="neutral"
                variant="ghost"
                :disabled="year >= 9999"
                :aria-label="t('features.timesheets.reviewPeriods.nextYear')"
                @click="year++"
              />
            </div>
            <div class="grid grid-cols-3 gap-1" :aria-label="t('features.timesheets.reviewPeriods.month')" role="group">
              <UButton
                v-for="item in months"
                :key="item.value"
                :label="item.label"
                :aria-label="item.accessibleLabel"
                :aria-pressed="month === item.value"
                :color="month === item.value ? 'primary' : 'neutral'"
                :variant="month === item.value ? 'soft' : 'ghost'"
                class="justify-center"
                @click="select(item.value)"
              />
            </div>
          </div>
        </template>
      </UPopover>
    </div>
    <UButton
      icon="i-lucide-chevron-right"
      color="neutral"
      variant="outline"
      :disabled="month >= '9999-12'"
      :aria-label="t('features.timesheets.reviewPeriods.nextMonthLabel')"
      @click="month = shiftReviewMonth(month, 1)"
    />
  </div>
</template>
