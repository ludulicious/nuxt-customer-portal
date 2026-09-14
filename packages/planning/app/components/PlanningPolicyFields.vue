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
  <div class="grid gap-4 sm:grid-cols-2">
    <UFormField v-for="key in numeric" :key="key" :name="prefix + key" :label="t(`planning.${key}`)"
      ><UInputNumber :model-value="state[key]" class="w-full" @update:model-value="setNumber(key, $event)"
    /></UFormField>
    <UFormField :name="prefix + 'cancellationEnabled'" :label="t('planning.cancellationEnabled')"
      ><USwitch
        :model-value="state.cancellationEnabled"
        @update:model-value="state = { ...state, cancellationEnabled: $event }"
    /></UFormField>
    <UFormField
      v-for="currency in props.currencies"
      :key="currency"
      :name="prefix + 'changeFees.' + currency"
      :label="t('planning.changeFeeCurrency', { currency })"
      ><UInputNumber
        :model-value="(state.changeFees[currency] || 0) / currencyScale(currency)"
        :min="0"
        @update:model-value="setFee(currency, $event)"
    /></UFormField>
  </div>
</template>
