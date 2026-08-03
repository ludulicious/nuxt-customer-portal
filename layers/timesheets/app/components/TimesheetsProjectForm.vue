<script setup lang="ts">
import { z } from 'zod'
import type { TimesheetsAdminBootstrap } from '#layers/timesheets/app/composables/useTimesheets'

export interface TimesheetsProjectFormModel {
  clientOrganizationId: string
  name: string
  code: string
  budgetHours: number | null
  budgetAmount: number | null
  activityTypeIds: string[]
}

const props = defineProps<{
  data: TimesheetsAdminBootstrap
  editing: boolean
  busy: boolean
  showCancel: boolean
  addActivity: (input: { name: string, billable: boolean }) => Promise<string | undefined>
}>()
const emit = defineEmits<{
  submit: []
  cancel: []
}>()
const form = defineModel<TimesheetsProjectFormModel>({ required: true })
const { t } = useI18n()
const activityFormOpen = ref(false)
const activityForm = reactive({ name: '', billable: true })
const currencyFormat = computed<Intl.NumberFormatOptions>(() => ({
  style: 'currency',
  currency: props.data.settings.currency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}))
const wholeNumberFormat: Intl.NumberFormatOptions = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}
const availableActivities = computed(() => props.data.activities
  .filter(activity => activity.active || form.value.activityTypeIds.includes(activity.id))
  .map(activity => ({ label: activity.name, value: activity.id })))
const schema = computed(() => z.object({
  clientOrganizationId: z.string().min(1, t('features.timesheets.validation.required')),
  name: z.string().trim().min(2, t('features.timesheets.validation.projectNameLength')).max(160),
  code: z.string().trim().max(40),
  budgetHours: z.number().min(0).nullable(),
  budgetAmount: z.number().min(0).nullable(),
  activityTypeIds: z.array(z.string()).min(1, t('features.timesheets.validation.selectActivity'))
}))

const createActivity = async () => {
  const activityId = await props.addActivity({
    name: activityForm.name.trim(),
    billable: activityForm.billable
  })
  if (!activityId) return
  if (!form.value.activityTypeIds.includes(activityId)) form.value.activityTypeIds.push(activityId)
  Object.assign(activityForm, { name: '', billable: true })
  activityFormOpen.value = false
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">
          {{ editing ? t('features.timesheets.admin.editProject') : t('features.timesheets.admin.newProject') }}
        </h2>
        <UButton v-if="editing" type="button" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t('features.timesheets.admin.close')" @click="emit('cancel')" />
      </div>
    </template>
    <UForm :state="form" :schema="schema" class="space-y-4" @submit="emit('submit')">
      <div>
        <UFormField name="clientOrganizationId" :label="t('features.timesheets.admin.client')" required>
          <USelect v-model="form.clientOrganizationId" :items="data.clients.map(item => ({ label: item.name, value: item.organizationId }))" value-key="value" class="w-full" />
        </UFormField>
        <p v-if="!data.clients.length" class="mt-2 text-sm text-muted">
          {{ t('features.timesheets.admin.createClientFirst') }}
          <ULink to="/admin/timesheets/clients" class="text-primary">{{ t('features.timesheets.admin.manageClients') }}</ULink>
        </p>
      </div>
      <UFormField name="name" :label="t('features.timesheets.fields.project')" required>
        <UInput v-model="form.name" class="w-full" />
      </UFormField>
      <UFormField name="code" :label="t('features.timesheets.admin.code')">
        <UInput v-model="form.code" class="w-full" />
      </UFormField>
      <div class="flex items-end gap-2">
        <UFormField name="activityTypeIds" :label="t('features.timesheets.admin.activities')" required class="min-w-0 flex-1">
          <USelectMenu v-model="form.activityTypeIds" multiple :items="availableActivities" value-key="value" class="w-full" />
        </UFormField>
        <UButton v-if="data.activities.some(item => item.active)" type="button" size="sm" variant="outline" icon="i-lucide-plus" :aria-expanded="activityFormOpen" @click="activityFormOpen = !activityFormOpen">
          {{ t('features.timesheets.admin.createActivity') }}
        </UButton>
      </div>
      <div v-if="!data.activities.some(item => item.active) || activityFormOpen" class="rounded-lg border border-default p-3">
        <UInput v-model="activityForm.name" :placeholder="t('features.timesheets.fields.activity')" class="w-full" />
        <div class="mt-3 flex items-center justify-between gap-3">
          <UCheckbox v-model="activityForm.billable" :label="t('features.timesheets.billable')" />
          <UButton type="button" size="sm" :loading="busy" :disabled="!activityForm.name.trim()" @click="createActivity">
            {{ t('features.timesheets.admin.createActivity') }}
          </UButton>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <UFormField name="budgetHours" :label="t('features.timesheets.admin.hoursBudget')">
          <UInputNumber v-model="form.budgetHours" :min="0" :step="1" :format-options="wholeNumberFormat" class="w-full" />
        </UFormField>
        <UFormField name="budgetAmount" :label="t('features.timesheets.admin.moneyBudget')">
          <UInputNumber v-model="form.budgetAmount" :min="0" :step="1" :format-options="currencyFormat" class="w-full" />
        </UFormField>
      </div>
      <div class="flex justify-end gap-2">
        <UButton v-if="showCancel" type="button" color="neutral" variant="outline" @click="emit('cancel')">
          {{ t('features.timesheets.cancel') }}
        </UButton>
        <UButton type="submit" :loading="busy">
          {{ editing ? t('features.timesheets.save') : t('features.timesheets.admin.createProject') }}
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
