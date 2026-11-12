<script setup lang="ts">
import { z } from 'zod'
import type { ClientTimesheetSettingsDto } from '../../shared/types/client-review-request'
import type { GenericClientDto } from '@nuxt-customer-portal/clients/types'

const props = defineProps<{ client: GenericClientDto }>()
const { t } = useI18n()
const toast = useToast()
const busy = ref(false)
const currentMonth = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }).slice(0, 7)
const state = reactive({
  accessMode: 'DISABLED' as 'DISABLED' | 'VIEW' | 'REVIEW',
  startingMonth: currentMonth,
  reviewInterval: 'WEEKLY' as 'WEEKLY' | 'TWO_WEEKLY' | 'MONTHLY'
})
const { data, error, refresh } = await useFetch<ClientTimesheetSettingsDto, import('#app').NuxtError<unknown>, string>(
  `/api/timesheets/admin/client-settings/${props.client.organizationId}`
)
const schema = computed(() =>
  z.object({
    accessMode: z.enum(['DISABLED', 'VIEW', 'REVIEW']),
    reviewInterval: z.enum(['WEEKLY', 'TWO_WEEKLY', 'MONTHLY']),
    startingMonth: z
      .string()
      .regex(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
      .refine(
        (value) =>
          state.accessMode !== 'REVIEW' ||
          !data.value?.earliestStartingMonth ||
          value >= data.value.earliestStartingMonth,
        t('features.timesheets.reviewPeriods.intervalConflict')
      )
  })
)
const applySettings = () => {
  if (!data.value) {
    return
  }
  Object.assign(state, {
    accessMode: data.value.accessMode,
    reviewInterval: data.value.scheduledReviewInterval ?? data.value.reviewInterval,
    startingMonth: [
      currentMonth,
      data.value.earliestStartingMonth ?? '',
      data.value.reviewIntervalEffectiveOn?.slice(0, 7) ?? ''
    ]
      .sort()
      .at(-1)!
  })
}
applySettings()
const save = async () => {
  busy.value = true
  try {
    data.value = await $fetch<ClientTimesheetSettingsDto, string>(
      `/api/timesheets/admin/client-settings/${props.client.organizationId}`,
      {
        method: 'PUT',
        body: {
          accessMode: state.accessMode,
          ...(state.accessMode === 'REVIEW'
            ? { reviewInterval: state.reviewInterval, startingMonth: state.startingMonth }
            : {})
        }
      }
    )
    state.reviewInterval = data.value.scheduledReviewInterval ?? data.value.reviewInterval
    toast.add({ title: t('features.timesheets.messages.saved'), color: 'success' })
  } catch (cause) {
    const conflict = (cause as { statusCode?: number }).statusCode === 409
    toast.add({
      title: t('features.timesheets.messages.saveError'),
      description: t(`features.timesheets.reviewPeriods.${conflict ? 'intervalConflict' : 'error'}`),
      color: 'error'
    })
    await refresh()
    applySettings()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-semibold">{{ t('features.timesheets.admin.clientSettings') }}</h2>
    </template>
    <UAlert v-if="error" color="error" :title="t('features.timesheets.reviewPeriods.error')" />
    <UForm v-else-if="data" novalidate :state="state" :schema="schema" class="space-y-4" @submit="save">
      <UFormField name="accessMode" :label="t('features.timesheets.timesheetAccess')">
        <USelect
          v-model="state.accessMode"
          :items="[
            { label: t('features.timesheets.clientAccess.disabled'), value: 'DISABLED' },
            { label: t('features.timesheets.clientAccess.view'), value: 'VIEW' },
            { label: t('features.timesheets.clientAccess.review'), value: 'REVIEW' }
          ]"
          value-key="value"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-if="state.accessMode === 'REVIEW'"
        name="reviewInterval"
        :label="t('features.timesheets.reviewPeriods.interval')"
      >
        <USelect
          v-model="state.reviewInterval"
          :items="
            ['WEEKLY', 'TWO_WEEKLY', 'MONTHLY'].map((value) => ({
              value,
              label: t(`features.timesheets.reviewPeriods.intervals.${value}`)
            }))
          "
          value-key="value"
          class="w-full"
        />
      </UFormField>
      <UFormField
        v-if="state.accessMode === 'REVIEW'"
        name="startingMonth"
        :label="t('features.timesheets.reviewPeriods.startingMonth')"
      >
        <TimesheetsMonthPicker
          v-model="state.startingMonth"
          :min="data.earliestStartingMonth || undefined"
          :disabled="busy"
        />
      </UFormField>
      <p v-if="data?.reviewIntervalEffectiveOn" class="text-sm text-muted">
        {{
          t('features.timesheets.reviewPeriods.scheduled', {
            date: data.reviewIntervalEffectiveOn,
            interval: t(`features.timesheets.reviewPeriods.intervals.${data.scheduledReviewInterval}`)
          })
        }}
      </p>
      <div class="flex justify-end">
        <UButton type="submit" icon="i-lucide-save" class="ml-auto flex min-w-28 justify-center" :loading="busy">{{
          t('features.timesheets.save')
        }}</UButton>
      </div>
    </UForm>
  </UCard>
</template>
