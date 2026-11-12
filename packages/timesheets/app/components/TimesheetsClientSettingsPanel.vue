<script setup lang="ts">
import { z } from 'zod'
import type { ClientTimesheetSettingsDto } from '../../shared/types/client-review-request'
import type { GenericClientDto } from '@nuxt-customer-portal/clients/types'

const props = defineProps<{ client: GenericClientDto }>()
const { t } = useI18n()
const toast = useToast()
const busy = ref(false)
const state = reactive({
  accessMode: 'DISABLED' as 'DISABLED' | 'VIEW' | 'REVIEW',
  effectiveFrom: 'NEXT_MONTH' as 'CURRENT_MONTH' | 'NEXT_MONTH',
  reviewInterval: 'WEEKLY' as 'WEEKLY' | 'TWO_WEEKLY' | 'MONTHLY'
})
const schema = z.object({
  accessMode: z.enum(['DISABLED', 'VIEW', 'REVIEW']),
  reviewInterval: z.enum(['WEEKLY', 'TWO_WEEKLY', 'MONTHLY']),
  effectiveFrom: z.enum(['CURRENT_MONTH', 'NEXT_MONTH'])
})
const { data, error, refresh } = await useFetch<ClientTimesheetSettingsDto, import('#app').NuxtError<unknown>, string>(
  `/api/timesheets/admin/client-settings/${props.client.organizationId}`
)
if (data.value) {
  Object.assign(state, data.value, { reviewInterval: data.value.scheduledReviewInterval ?? data.value.reviewInterval })
}
const save = async () => {
  busy.value = true
  try {
    data.value = await $fetch<ClientTimesheetSettingsDto, string>(
      `/api/timesheets/admin/client-settings/${props.client.organizationId}`,
      {
        method: 'PUT',
        body: state
      }
    )
    Object.assign(state, {
      reviewInterval: data.value.scheduledReviewInterval ?? data.value.reviewInterval,
      effectiveFrom: 'NEXT_MONTH'
    })
    toast.add({ title: t('features.timesheets.messages.saved'), color: 'success' })
  } catch (cause) {
    const conflict = (cause as { statusCode?: number }).statusCode === 409
    toast.add({
      title: t('features.timesheets.messages.saveError'),
      description: t(`features.timesheets.reviewPeriods.${conflict ? 'intervalConflict' : 'error'}`),
      color: 'error'
    })
    await refresh()
    state.effectiveFrom = 'NEXT_MONTH'
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
        :description="
          t(
            `features.timesheets.reviewPeriods.${data.canChangeCurrentMonth ? 'currentMonthHelp' : 'protectedMonthHelp'}`
          )
        "
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
        v-if="state.accessMode === 'REVIEW' && data.canChangeCurrentMonth"
        name="effectiveFrom"
        :label="t('features.timesheets.reviewPeriods.appliesFrom')"
      >
        <USelect
          v-model="state.effectiveFrom"
          :items="[
            { value: 'CURRENT_MONTH', label: t('features.timesheets.reviewPeriods.currentMonth') },
            { value: 'NEXT_MONTH', label: t('features.timesheets.reviewPeriods.followingMonth') }
          ]"
          class="w-full"
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
