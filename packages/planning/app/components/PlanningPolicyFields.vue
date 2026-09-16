<script setup lang="ts">
import { currencyScale } from '@nuxt-customer-portal/products/shared/money'
import type { PlanningPolicy } from '../../shared/types'

const state = defineModel<PlanningPolicy>({ required: true })
const props = withDefaults(defineProps<{ prefix?: string; currencies?: string[] }>(), {
  prefix: '',
  currencies: () => ['EUR']
})
const { t } = useI18n()
const numeric = [
  'reservationMinutes',
  'slotIntervalMinutes',
  'displayIntervalMinutes',
  'bookingHorizonDays',
  'minimumNoticeMinutes',
  'freeChanges',
  'rescheduleCutoffMinutes',
  'cancellationCutoffMinutes',
  'refundPercentage'
] as const
const groups = [
  {
    key: 'schedule',
    icon: 'i-lucide-clock-3',
    fields: ['reservationMinutes', 'slotIntervalMinutes', 'displayIntervalMinutes']
  },
  {
    key: 'bookingWindow',
    icon: 'i-lucide-calendar-range',
    fields: ['bookingHorizonDays', 'minimumNoticeMinutes']
  },
  {
    key: 'changes',
    icon: 'i-lucide-calendar-sync',
    fields: ['freeChanges', 'rescheduleCutoffMinutes']
  }
] as const
function setNumber(key: (typeof numeric)[number], value: number | null | undefined) {
  state.value = { ...state.value, [key]: value ?? 0 }
}
function setFee(currency: string, value: number | null | undefined) {
  const changeFees = { ...state.value.changeFees }
  if (value && value > 0) {
    changeFees[currency] = Math.round(value * currencyScale(currency))
  } else {
    Reflect.deleteProperty(changeFees, currency)
  }
  state.value = { ...state.value, changeFees }
}
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <section
      v-for="group in groups"
      :key="group.key"
      class="rounded-lg border border-default bg-muted/20 p-4"
    >
      <div class="mb-4 flex items-start gap-3">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UIcon :name="group.icon" class="size-5" />
        </span>
        <div>
          <h3 class="font-semibold text-highlighted">{{ t(`planning.policyGroup.${group.key}.title`) }}</h3>
          <p class="mt-0.5 text-sm text-muted">{{ t(`planning.policyGroup.${group.key}.description`) }}</p>
        </div>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField v-for="key in group.fields" :key="key" :name="prefix + key" :label="t(`planning.${key}`)">
          <UInputNumber
            :model-value="state[key]"
            class="w-36 max-w-full"
            @update:model-value="setNumber(key, $event)"
          />
        </UFormField>
      </div>
      <div v-if="group.key === 'changes' && props.currencies.length" class="mt-4 border-t border-default pt-4">
        <p class="mb-3 text-sm font-medium text-highlighted">{{ t('planning.changeFees') }}</p>
        <div class="flex flex-wrap gap-4">
          <UFormField
            v-for="currency in props.currencies"
            :key="currency"
            :name="prefix + 'changeFees.' + currency"
            :label="t('planning.changeFeeCurrency', { currency })"
          >
            <UInputNumber
              :model-value="(state.changeFees[currency] || 0) / currencyScale(currency)"
              :min="0"
              class="w-36 max-w-full"
              @update:model-value="setFee(currency, $event)"
            />
          </UFormField>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-default bg-muted/20 p-4">
      <div class="mb-4 flex items-start gap-3">
        <span class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <UIcon name="i-lucide-calendar-x-2" class="size-5" />
        </span>
        <div>
          <h3 class="font-semibold text-highlighted">{{ t('planning.policyGroup.cancellations.title') }}</h3>
          <p class="mt-0.5 text-sm text-muted">{{ t('planning.policyGroup.cancellations.description') }}</p>
        </div>
      </div>
      <UFormField :name="prefix + 'cancellationEnabled'" class="mb-4">
        <div class="flex max-w-md items-center justify-between gap-4 rounded-md border border-default bg-default p-3">
          <span class="text-sm font-medium">{{ t('planning.cancellationEnabled') }}</span>
          <USwitch
            :model-value="state.cancellationEnabled"
            :aria-label="t('planning.cancellationEnabled')"
            @update:model-value="state = { ...state, cancellationEnabled: $event }"
          />
        </div>
      </UFormField>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          :name="prefix + 'cancellationCutoffMinutes'"
          :label="t('planning.cancellationCutoffMinutes')"
        >
          <UInputNumber
            :model-value="state.cancellationCutoffMinutes"
            class="w-36 max-w-full"
            @update:model-value="setNumber('cancellationCutoffMinutes', $event)"
          />
        </UFormField>
        <UFormField :name="prefix + 'refundPercentage'" :label="t('planning.refundPercentage')">
          <UInputNumber
            :model-value="state.refundPercentage"
            class="w-36 max-w-full"
            @update:model-value="setNumber('refundPercentage', $event)"
          />
        </UFormField>
      </div>
    </section>
  </div>
</template>
