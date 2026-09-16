<script setup lang="ts">
import { currencyScale } from '@nuxt-customer-portal/products/shared/money'
import type { PlanningPolicy } from '../../shared/types'

const state = defineModel<PlanningPolicy>({ required: true })
const overrides = defineModel<Partial<PlanningPolicy>>('overrides')
const props = withDefaults(defineProps<{ prefix?: string; currencies?: string[]; compact?: boolean }>(), {
  prefix: '',
  currencies: () => ['EUR'],
  compact: false
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
const cancellationFields = ['cancellationEnabled', 'cancellationCutoffMinutes', 'refundPercentage'] as const
function overrideFields(group: (typeof groups)[number]) {
  return group.key === 'changes' ? [...group.fields, 'changeFees'] as const : group.fields
}
function sectionEnabled(fields: readonly (keyof PlanningPolicy)[]) {
  return overrides.value === undefined || fields.some((key) => Object.hasOwn(overrides.value!, key))
}
function toggleSection(fields: readonly (keyof PlanningPolicy)[], enabled: boolean) {
  if (overrides.value === undefined) {
    return
  }
  const next = { ...overrides.value }
  for (const key of fields) {
    if (enabled) {
      Object.assign(next, { [key]: structuredClone(toRaw(state.value[key])) })
    } else {
      Reflect.deleteProperty(next, key)
    }
  }
  overrides.value = next
}
if (overrides.value !== undefined) {
  const next = { ...overrides.value }
  for (const fields of [...groups.map(overrideFields), cancellationFields]) {
    if (fields.some((key) => Object.hasOwn(next, key))) {
      for (const key of fields) {
        Object.assign(next, { [key]: structuredClone(toRaw(state.value[key])) })
      }
    }
  }
  overrides.value = next
}
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
  <div class="grid gap-4" :class="{ 'lg:grid-cols-2': !compact }">
    <section
      v-for="group in groups"
      :key="group.key"
      class="rounded-lg border border-default bg-muted/20"
      :class="compact ? 'p-3' : 'p-4'"
    >
      <div class="flex items-start gap-3" :class="compact ? 'mb-3' : 'mb-4'">
        <span class="flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" :class="compact ? 'size-8' : 'size-9'">
          <UIcon :name="group.icon" :class="compact ? 'size-4' : 'size-5'" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold text-highlighted">{{ t(`planning.policyGroup.${group.key}.title`) }}</h3>
          <p v-if="!compact" class="mt-0.5 text-sm text-muted">
            {{ t(`planning.policyGroup.${group.key}.description`) }}
          </p>
        </div>
        <USwitch
          v-if="overrides !== undefined"
          :model-value="sectionEnabled(overrideFields(group))"
          :aria-label="t('planning.overridePolicySection')"
          @update:model-value="toggleSection(overrideFields(group), $event)"
        />
      </div>
      <div v-if="sectionEnabled(overrideFields(group))" class="grid gap-4" :class="{ 'sm:grid-cols-2': !compact }">
        <UFormField v-for="key in group.fields" :key="key" :name="prefix + key" :label="t(`planning.${key}`)">
          <UInputNumber
            :model-value="state[key]"
            :class="compact ? 'w-full' : 'w-36 max-w-full'"
            @update:model-value="setNumber(key, $event)"
          />
        </UFormField>
      </div>
      <div
        v-if="sectionEnabled(overrideFields(group)) && group.key === 'changes' && props.currencies.length"
        class="mt-4 border-t border-default pt-4"
      >
        <p class="mb-3 text-sm font-medium text-highlighted">{{ t('planning.changeFees') }}</p>
        <div class="grid gap-4" :class="{ 'sm:grid-cols-2': !compact }">
          <UFormField
            v-for="currency in props.currencies"
            :key="currency"
            :name="prefix + 'changeFees.' + currency"
            :label="t('planning.changeFeeCurrency', { currency })"
          >
            <UInputNumber
              :model-value="(state.changeFees[currency] || 0) / currencyScale(currency)"
              :min="0"
              :class="compact ? 'w-full' : 'w-36 max-w-full'"
              @update:model-value="setFee(currency, $event)"
            />
          </UFormField>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-default bg-muted/20" :class="compact ? 'p-3' : 'p-4'">
      <div class="flex items-start gap-3" :class="compact ? 'mb-3' : 'mb-4'">
        <span class="flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary" :class="compact ? 'size-8' : 'size-9'">
          <UIcon name="i-lucide-calendar-x-2" :class="compact ? 'size-4' : 'size-5'" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="font-semibold text-highlighted">{{ t('planning.policyGroup.cancellations.title') }}</h3>
          <p v-if="!compact" class="mt-0.5 text-sm text-muted">
            {{ t('planning.policyGroup.cancellations.description') }}
          </p>
        </div>
        <USwitch
          v-if="overrides !== undefined"
          :model-value="sectionEnabled(cancellationFields)"
          :aria-label="t('planning.overridePolicySection')"
          @update:model-value="toggleSection(cancellationFields, $event)"
        />
      </div>
      <UFormField v-if="sectionEnabled(cancellationFields)" :name="prefix + 'cancellationEnabled'" class="mb-4">
        <div class="flex max-w-md items-center justify-between gap-4 rounded-md border border-default bg-default p-3">
          <span class="text-sm font-medium">{{ t('planning.cancellationEnabled') }}</span>
          <USwitch
            :model-value="state.cancellationEnabled"
            :aria-label="t('planning.cancellationEnabled')"
            @update:model-value="state = { ...state, cancellationEnabled: $event }"
          />
        </div>
      </UFormField>
      <div v-if="sectionEnabled(cancellationFields)" class="grid gap-4" :class="{ 'sm:grid-cols-2': !compact }">
        <UFormField
          :name="prefix + 'cancellationCutoffMinutes'"
          :label="t('planning.cancellationCutoffMinutes')"
        >
          <UInputNumber
            :model-value="state.cancellationCutoffMinutes"
            :class="compact ? 'w-full' : 'w-36 max-w-full'"
            @update:model-value="setNumber('cancellationCutoffMinutes', $event)"
          />
        </UFormField>
        <UFormField :name="prefix + 'refundPercentage'" :label="t('planning.refundPercentage')">
          <UInputNumber
            :model-value="state.refundPercentage"
            :class="compact ? 'w-full' : 'w-36 max-w-full'"
            @update:model-value="setNumber('refundPercentage', $event)"
          />
        </UFormField>
      </div>
    </section>
  </div>
</template>
