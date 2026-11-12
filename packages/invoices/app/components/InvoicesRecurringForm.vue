<script setup lang="ts">
import {
  recurringInvoiceSchema,
  recurrencePeriods,
  periodPlaceholders,
  calendarDateSchema,
  dateInTimeZone,
  renderPeriodText,
  type RecurringInvoiceDto,
  type RecurringInvoiceInput
} from '../../shared/recurring-invoice'
import type { InvoicesAdminBootstrap } from '../composables/useInvoices'
import type { DeepReadonly } from 'vue'

const props = defineProps<{ data: InvoicesAdminBootstrap; initial?: DeepReadonly<RecurringInvoiceDto> }>()
const emit = defineEmits<{ saved: []; cancel: [] }>()
const { t, locale } = useI18n()
const placeholderGroups = [
  { label: 'currentPeriod', items: periodPlaceholders.filter((value) => !value.startsWith('previous_')) },
  { label: 'previousPeriod', items: periodPlaceholders.filter((value) => value.startsWith('previous_')) }
]
const api = useInvoices()
const busy = ref(false)
const error = ref('')
const form = ref<{ setErrors: (errors: Array<{ name: string; message: string }>) => void } | null>(null)
const root = ref<HTMLElement | null>(null)
const lineEditor = ref<{ focusError: (errors: Array<{ name?: string }>) => Promise<void> } | null>(null)
const schema = computed(() => ({
  '~standard': {
    ...recurringInvoiceSchema['~standard'],
    validate: async (value: unknown) => {
      const result = await recurringInvoiceSchema['~standard'].validate(value)
      if (!result.issues) {
        return result
      }
      return {
        issues: result.issues.map((issue) => ({
          ...issue,
          message: t(
            issue.message === 'Unknown or malformed period placeholder'
              ? 'features.invoices.recurring.invalidPlaceholder'
              : issue.message === 'End date must not precede start date'
                ? 'features.invoices.recurring.invalidEndDate'
                : issue.message === 'Invalid timezone'
                  ? 'features.invoices.recurring.invalidTimeZone'
                  : 'features.invoices.recurring.invalidValue'
          )
        }))
      }
    }
  }
}))
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const state = reactive<RecurringInvoiceInput>(
  props.initial
    ? recurringInvoiceSchema.parse(props.initial)
    : {
        name: '',
        period: 'monthly',
        startDate: dateInTimeZone(new Date(), timeZone),
        endDate: null,
        timeZone,
        locale: locale.value === 'nl' ? 'nl' : 'en',
        paymentTermDays: 30,
        enabled: true,
        clientOrganizationId: '',
        contactId: null,
        currency: props.data.settings.currency,
        subject: '',
        notes: '',
        lines: [
          {
            description: '',
            quantityMilli: 1000,
            unit: 'item',
            unitPriceMinor: 0,
            vatRateBasisPoints: props.data.settings.defaultVatRateBasisPoints
          }
        ]
      }
)
const endDate = computed({
  get: () => state.endDate ?? '',
  set: (value: string) => {
    state.endDate = value || null
  }
})
const subject = computed({
  get: () => state.subject ?? '',
  set: (value: string) => {
    state.subject = value
  }
})
const notes = computed({
  get: () => state.notes ?? '',
  set: (value: string) => {
    state.notes = value
  }
})
const locked = computed(() => Boolean(props.initial?.lastGeneratedDate))
const client = computed(() => props.data.clients.find((item) => item.organizationId === state.clientOrganizationId))
const clients = computed(() => [
  ...props.data.clients.map((item) => ({ label: item.name, value: item.organizationId })),
  ...(state.clientOrganizationId && !client.value
    ? [
        {
          label: `${state.clientOrganizationId} (${t('features.invoices.recurring.unavailable')})`,
          value: state.clientOrganizationId
        }
      ]
    : [])
])
const contacts = computed(() => [
  { label: t('features.invoices.recurring.noContact'), value: 'none' },
  ...(client.value?.contacts ?? []).map((item) => ({ label: item.name, value: item.id })),
  ...(state.contactId && !client.value?.contacts.some((item) => item.id === state.contactId)
    ? [{ label: `${state.contactId} (${t('features.invoices.recurring.unavailable')})`, value: state.contactId }]
    : [])
])
const contactId = computed({
  get: () => state.contactId ?? 'none',
  set: (value: string) => {
    state.contactId = value === 'none' ? null : value
  }
})
watch(
  () => state.clientOrganizationId,
  () => {
    state.contactId = null
  }
)
const periods = computed(() =>
  recurrencePeriods.map((value) => ({ value, label: t(`features.invoices.recurring.periods.${value}`) }))
)
const preview = computed(() => {
  if (!calendarDateSchema.safeParse(state.startDate).success) {
    return null
  }
  const date = locked.value ? (props.initial?.nextDate ?? state.startDate) : state.startDate
  return {
    subject: renderPeriodText(state.subject, state, date),
    notes: renderPeriodText(state.notes, state, date),
    lines: state.lines.map((line) => renderPeriodText(line.description, state, date))
  }
})
const focusErrors = async (errors: Array<{ name?: string }>) => {
  await lineEditor.value?.focusError(errors)
  await nextTick()
  const field = root.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
  const container = root.value?.closest<HTMLElement>('.invoices-list-scroll')
  if (field && container) {
    field.focus({ preventScroll: true })
    container.scrollTo({
      top:
        container.scrollTop +
        field.getBoundingClientRect().top -
        container.getBoundingClientRect().top -
        container.clientHeight / 2,
      behavior: 'smooth'
    })
  }
}
const save = async () => {
  busy.value = true
  error.value = ''
  try {
    await api.saveRecurringInvoice(recurringInvoiceSchema.parse(state), props.initial?.id)
    emit('saved')
  } catch (cause) {
    const failure = cause as { statusCode?: number; data?: { message?: string } }
    if (failure.statusCode === 409) {
      form.value?.setErrors([{ name: 'startDate', message: t('features.invoices.recurring.locked') }])
    } else if (failure.statusCode === 400) {
      form.value?.setErrors([
        {
          name: failure.data?.message?.includes('Contact') ? 'contactId' : 'clientOrganizationId',
          message: t('features.invoices.recurring.invalidRelation')
        }
      ])
    } else {
      error.value = t('features.invoices.recurring.saveError')
    }
  } finally {
    busy.value = false
  }
}
onMounted(async () => {
  await nextTick()
  if (!import.meta.client || !root.value) {
    return
  }
  const container = root.value.closest<HTMLElement>('.invoices-list-scroll')
  if (container) {
    const bounds = root.value.getBoundingClientRect()
    const available = container.clientHeight
    const offset = bounds.height <= available ? (available - bounds.height) / 2 : 0
    container.scrollTo({
      top: container.scrollTop + bounds.top - container.getBoundingClientRect().top - offset,
      behavior: 'smooth'
    })
  }
  root.value.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus({ preventScroll: true })
})
</script>

<template>
  <div
    ref="root"
    class="scroll-mt-24 rounded-lg border border-primary p-4 sm:p-6"
    @keydown.esc.stop="!busy && emit('cancel')"
  >
    <UForm
      ref="form"
      :schema="schema"
      :state="state"
      novalidate
      class="space-y-4"
      @submit="save"
      @error="focusErrors($event.errors)"
    >
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">
          {{ t(initial ? 'features.invoices.recurring.edit' : 'features.invoices.recurring.new') }}
        </h2>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="ghost"
          :aria-label="t('common.close')"
          :disabled="busy"
          @click="emit('cancel')"
        />
      </div>
      <UAlert v-if="error" color="error" :title="error" />
      <UAlert v-if="locked" color="neutral" variant="subtle" :title="t('features.invoices.recurring.locked')" />
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField name="name" :label="t('features.invoices.recurring.name')" required
          ><UInput v-model="state.name" class="w-full"
        /></UFormField>
        <UFormField name="clientOrganizationId" :label="t('features.invoices.admin.client')" required
          ><USelect
            v-model="state.clientOrganizationId"
            :items="clients"
            :placeholder="t('features.invoices.admin.selectClient')"
            class="w-full"
        /></UFormField>
        <UFormField
          v-if="client && client.clientType !== 'person'"
          name="contactId"
          :label="t('features.invoices.admin.contact')"
          ><USelect v-model="contactId" :items="contacts" class="w-full"
        /></UFormField>
        <UFormField name="period" :label="t('features.invoices.recurring.period')"
          ><USelect v-model="state.period" :items="periods" :disabled="locked" class="w-full"
        /></UFormField>
        <UFormField name="startDate" :label="t('features.invoices.recurring.startDate')" required
          ><UInput v-model="state.startDate" type="date" :disabled="locked" class="w-full"
        /></UFormField>
        <UFormField
          name="endDate"
          :label="t('features.invoices.recurring.endDate')"
          :help="t('features.invoices.recurring.endHelp')"
          ><UInput v-model="endDate" type="date" class="w-full"
        /></UFormField>
        <UFormField name="timeZone" :label="t('features.invoices.recurring.timeZone')"
          ><UInput v-model="state.timeZone" :disabled="locked" class="w-full"
        /></UFormField>
        <UFormField name="paymentTermDays" :label="t('features.invoices.recurring.paymentTermDays')"
          ><UInput v-model.number="state.paymentTermDays" type="number" class="w-full"
        /></UFormField>
        <UFormField name="currency" :label="t('features.invoices.admin.currency')"
          ><UInput v-model="state.currency" class="w-full"
        /></UFormField>
        <UFormField name="locale" :label="t('features.invoices.recurring.locale')"
          ><USelect
            v-model="state.locale"
            :items="[
              { label: 'English', value: 'en' },
              { label: 'Nederlands', value: 'nl' }
            ]"
            class="w-full"
        /></UFormField>
      </div>
      <UFormField name="enabled"
        ><UCheckbox v-model="state.enabled" :label="t('features.invoices.recurring.enabled')"
      /></UFormField>
      <UAlert color="neutral" variant="subtle" :title="t('features.invoices.recurring.placeholderHelp')">
        <template #description
          ><div v-for="group in placeholderGroups" :key="group.label" class="mt-2">
            <p class="mb-2 font-medium">{{ t(`features.invoices.recurring.${group.label}`) }}</p>
            <div class="flex flex-wrap gap-2">
              <code
                v-for="placeholder in group.items"
                :key="placeholder"
                class="rounded border border-default bg-default px-2 py-1 text-xs text-default"
                v-text="'{{' + placeholder + '}}'"
              />
            </div>
          </div>
          <p class="mt-2">{{ t('features.invoices.recurring.periodHelp') }}</p>
          <p class="mt-2">{{ t('features.invoices.recurring.previousPeriodHelp') }}</p></template
        >
      </UAlert>
      <UFormField name="subject" :label="t('features.invoices.admin.subject')"
        ><UTextarea v-model="subject" class="w-full"
      /></UFormField>
      <InvoicesInvoiceLinesEditor
        ref="lineEditor"
        v-model="state.lines"
        :currency="/^[A-Z]{3}$/.test(state.currency) ? state.currency : data.settings.currency"
        :default-vat-rate-basis-points="data.settings.defaultVatRateBasisPoints"
      />
      <UFormField name="notes" :label="t('features.invoices.admin.notes')"
        ><UTextarea v-model="notes" class="w-full"
      /></UFormField>
      <section v-if="preview" class="space-y-2 rounded-lg border border-default bg-elevated p-4 text-sm wrap-anywhere">
        <h3 class="font-medium">{{ t('features.invoices.recurring.preview') }}</h3>
        <p class="whitespace-pre-wrap">{{ preview.subject }}</p>
        <ul class="list-inside list-disc">
          <li v-for="(line, index) in preview.lines" :key="index">{{ line }}</li>
        </ul>
        <p class="whitespace-pre-wrap">{{ preview.notes }}</p>
      </section>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" :disabled="busy" @click="emit('cancel')">{{
          t('common.cancel')
        }}</UButton>
        <UButton type="submit" :loading="busy" :disabled="!state.name.trim() || !state.clientOrganizationId">{{
          t('common.save')
        }}</UButton>
      </div>
    </UForm>
  </div>
</template>
