<script setup lang="ts">
import { z } from 'zod'
import type { PurchaseAppointment } from '../../shared/purchase-appointment'

const props = defineProps<{ title?: string }>()
const appointments = defineModel<PurchaseAppointment[]>({ default: () => [] })
const { t } = useI18n()
const state = reactive({ enabled: false, date: '2026-10-05', time: '19:30', timezone: 'Europe/Amsterdam' })
const zones = ['UTC', ...Intl.supportedValuesOf('timeZone')]
const schema = z.object({
  enabled: z.boolean(),
  date: z.iso.date(),
  time: z.iso.time({ precision: -1 }),
  timezone: z.string().refine((value) => zones.includes(value))
})
const formSchema = useProductFormSchema(schema)
watchEffect(() => {
  const result = schema.safeParse(state)
  if (!state.enabled || !result.success) {
    appointments.value = []
    return
  }
  const start = new Date(`${state.date}T${state.time}:00Z`)
  appointments.value = [
    {
      id: 'preview-appointment',
      orderLineId: 'example',
      title: props.title || t('products.appointmentPreviewTitle'),
      start: start.toISOString(),
      end: new Date(start.getTime() + 30 * 60000).toISOString(),
      timezone: state.timezone,
      status: 'confirmed'
    }
  ]
})
</script>

<template>
  <UForm
    :state="state"
    :schema="formSchema"
    novalidate
    class="space-y-3 rounded-lg border border-default p-4"
    @submit.prevent
  >
    <UFormField name="enabled">
      <USwitch v-model="state.enabled" :label="t('products.appointmentPreviewEnabled')" />
    </UFormField>
    <template v-if="state.enabled">
      <p class="text-sm text-muted">{{ t('products.appointmentPreviewHelp') }}</p>
      <div class="grid gap-3 sm:grid-cols-3">
        <UFormField name="date" :label="t('products.appointmentPreviewDate')">
          <UInput v-model="state.date" type="date" class="w-full" />
        </UFormField>
        <UFormField name="time" :label="t('products.appointmentPreviewTime')">
          <UInput v-model="state.time" type="time" class="w-full" />
        </UFormField>
        <UFormField name="timezone" :label="t('products.appointmentPreviewTimezone')">
          <USelectMenu v-model="state.timezone" :items="zones" class="w-full" />
        </UFormField>
      </div>
    </template>
  </UForm>
</template>
