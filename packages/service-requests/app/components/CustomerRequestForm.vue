<script setup lang="ts">
import { z } from 'zod'
import type {
  ServiceRequest,
  ServiceRequestCreateInput
} from '@nuxt-customer-portal/service-requests/shared/types/service-request'

const props = defineProps<{
  initialData?: Partial<ServiceRequest>
  loading?: boolean
}>()

const { t } = useI18n()
const { activeOrganizationType } = usePortalSession()

const emit = defineEmits<{
  submit: [data: ServiceRequestCreateInput]
  cancel: []
}>()

const editMode = computed(() => !!props.initialData?.id)

const state = reactive({
  clientOrganizationId: props.initialData?.clientOrganizationId || '',
  title: props.initialData?.title || '',
  description: props.initialData?.description || '',
  contactName: props.initialData?.contactName || '',
  contactEmail: props.initialData?.contactEmail || '',
  contactPhone: props.initialData?.contactPhone || '',
  requestedDate: props.initialData?.requestedDate || '',
  serviceLocation: props.initialData?.serviceLocation || '',
  priority: props.initialData?.priority || 'MEDIUM',
  category: props.initialData?.category || ''
})

watch(
  () => props.initialData,
  (data) => {
    state.title = data?.title || ''
    state.clientOrganizationId = data?.clientOrganizationId || ''
    state.description = data?.description || ''
    state.contactName = data?.contactName || ''
    state.contactEmail = data?.contactEmail || ''
    state.contactPhone = data?.contactPhone || ''
    state.requestedDate = data?.requestedDate || ''
    state.serviceLocation = data?.serviceLocation || ''
    state.priority = data?.priority || 'MEDIUM'
    state.category = data?.category || ''
  }
)

const schema = computed(() => z.object({
  clientOrganizationId: activeOrganizationType.value === 'PROVIDER'
    ? z.string().min(1, t('features.serviceRequests.validation.clientRequired'))
    : z.string().optional(),
  title: z.string()
    .min(3, t('features.serviceRequests.validation.titleMin'))
    .max(200, t('features.serviceRequests.validation.titleMax')),
  description: z.string()
    .min(10, t('features.serviceRequests.validation.descriptionMin'))
    .max(5000, t('features.serviceRequests.validation.descriptionMax')),
  contactName: z.string().max(200, t('features.serviceRequests.validation.contactNameMax')).optional(),
  contactEmail: z.union([
    z.string().email(t('features.serviceRequests.validation.emailInvalid')),
    z.literal('')
  ]).optional(),
  contactPhone: z.string().max(80, t('features.serviceRequests.validation.contactPhoneMax')).optional(),
  requestedDate: z.string().optional(),
  serviceLocation: z.string().max(500, t('features.serviceRequests.validation.serviceLocationMax')).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  category: z.string().max(100, t('features.serviceRequests.validation.categoryMax')).optional()
}))

const { priorityOptions, getStatusBadgeText, getStatusColor } = useServiceRequests()

const handleSubmit = () => {
  emit('submit', state)
}
</script>

<template>
  <UForm :state="state" :schema="schema" :validate-on="[]" class="w-full" @submit="handleSubmit">
    <!-- Wrap in real DOM nodes so spacing is guaranteed -->
    <div class="space-y-6">
      <ClientsClientPicker
        v-if="activeOrganizationType === 'PROVIDER'"
        v-model="state.clientOrganizationId"
        module-id="service-requests"
        :label="t('features.serviceRequests.fields.client')"
        required
      />
      <div>
        <UFormField :label="t('features.serviceRequests.fields.title')" name="title" required>
          <UInput
            v-model="state.title"
            :placeholder="t('features.serviceRequests.fields.title')"
            class="w-full"
            size="lg"
          />
        </UFormField>
      </div>

      <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <UFormField :label="t('features.serviceRequests.fields.contactName')" name="contactName">
          <UInput v-model="state.contactName" class="w-full" />
        </UFormField>
        <UFormField :label="t('features.serviceRequests.fields.contactEmail')" name="contactEmail">
          <UInput v-model="state.contactEmail" type="email" class="w-full" />
        </UFormField>
        <UFormField :label="t('features.serviceRequests.fields.contactPhone')" name="contactPhone">
          <UInput v-model="state.contactPhone" type="tel" class="w-full" />
        </UFormField>
        <UFormField :label="t('features.serviceRequests.fields.requestedDate')" name="requestedDate">
          <UInput v-model="state.requestedDate" type="date" class="w-full" />
        </UFormField>
      </div>
      <UFormField :label="t('features.serviceRequests.fields.serviceLocation')" name="serviceLocation">
        <UInput v-model="state.serviceLocation" class="w-full" :placeholder="t('features.serviceRequests.placeholders.serviceLocation')" />
      </UFormField>

      <div>
        <UFormField
          :label="t('features.serviceRequests.fields.description')"
          name="description"
          required
          class="w-full"
        >
          <UTextarea
            v-model="state.description"
            class="w-full"
            :placeholder="t('features.serviceRequests.fields.description')"
            :rows="7"
            size="lg"
          />
        </UFormField>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <UFormField :label="t('features.serviceRequests.fields.priority')" name="priority" class="w-full">
            <USelect
              v-model="state.priority"
              class="w-full"
              :items="priorityOptions.filter((i) => i.value !== undefined)"
              size="lg"
            />
          </UFormField>
        </div>

        <div>
          <UFormField :label="t('features.serviceRequests.fields.category')" name="category" class="w-full">
            <UInput
              v-model="state.category"
              class="w-full"
              :placeholder="t('features.serviceRequests.placeholders.category')"
              size="lg"
            />
          </UFormField>
        </div>
      </div>

      <div v-if="editMode && props.initialData?.status" class="rounded-lg border border-default bg-elevated/20 p-4">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-medium text-muted">
            {{ t('features.serviceRequests.fields.status') }}
          </div>
          <UBadge :color="getStatusColor(props.initialData.status)" variant="soft">
            {{ getStatusBadgeText(props.initialData.status) }}
          </UBadge>
        </div>
      </div>

      <div class="pt-4 border-t border-default">
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <UButton type="button" variant="outline" size="lg" :disabled="loading" @click="$emit('cancel')">
            {{ t('common.cancel') }}
          </UButton>
          <UButton type="submit" color="primary" size="lg" :loading="loading">
            {{ editMode ? t('common.save') : t('common.create') }}
          </UButton>
        </div>
      </div>
    </div>
  </UForm>
</template>
