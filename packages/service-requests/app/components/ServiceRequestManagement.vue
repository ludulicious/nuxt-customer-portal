<script setup lang="ts">
import { z } from 'zod'
import type { ServiceRequest } from '@nuxt-customer-portal/service-requests/shared/types/service-request'

const props = defineProps<{ request: ServiceRequest }>()
const emit = defineEmits<{ updated: [request: ServiceRequest] }>()
const request = toRef(props, 'request')
const { t } = useI18n()
const { statusOptions, priorityOptions } = useServiceRequests()
const { adminUpdateRequest, getAssignees } = useAdminServiceRequests()
const toast = useToast()
const loading = ref(true)
const updating = ref(false)
const assignees = ref<Array<{ id: string; name: string; image: string | null }>>([])
const state = reactive({
  status: 'OPEN' as ServiceRequest['status'],
  priority: 'MEDIUM' as ServiceRequest['priority'],
  assignedToId: '__unassigned',
  internalNotes: ''
})
const schema = computed(() =>
  z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
    assignedToId: z.string(),
    internalNotes: z.string().max(5000, t('features.serviceRequests.validation.notes'))
  })
)
const userOptions = computed(() => [
  { label: t('features.serviceRequests.list.unassigned'), value: '__unassigned' },
  ...assignees.value.map((user) => ({
    label: user.name,
    value: user.id,
    avatar: { src: user.image || undefined, alt: user.name }
  })),
  ...(request.value?.assignedToId && !assignees.value.some((user) => user.id === request.value?.assignedToId)
    ? [{ label: t('features.serviceRequests.list.previousAssignee'), value: request.value.assignedToId }]
    : [])
])
const reset = () => {
  if (request.value) {
    Object.assign(state, {
      status: request.value.status,
      priority: request.value.priority,
      assignedToId: request.value.assignedToId || '__unassigned',
      internalNotes: request.value.internalNotes || ''
    })
  }
}
watch(request, reset, { immediate: true })
onMounted(async () => {
  try {
    assignees.value = await getAssignees()
    reset()
  } catch {
    toast.add({ title: t('features.serviceRequests.messages.fetchError'), color: 'error' })
  } finally {
    loading.value = false
  }
})
const save = async () => {
  updating.value = true
  try {
    const updated = await adminUpdateRequest(request.value.id, {
      ...state,
      assignedToId: state.assignedToId === '__unassigned' ? '' : state.assignedToId
    })
    emit('updated', updated)
    await nextTick()
    reset()
    toast.add({ title: t('features.serviceRequests.messages.updateSuccess'), color: 'success' })
  } catch {
    toast.add({ title: t('features.serviceRequests.messages.updateError'), color: 'error' })
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header
      ><h2 class="font-semibold">{{ t('features.serviceRequests.actions.adminActions') }}</h2></template
    >
    <UForm :disabled="loading || updating" :schema="schema" :state="state" novalidate class="space-y-4" @submit="save">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField name="status" :label="t('features.serviceRequests.fields.status')"
          ><USelect v-model="state.status" :items="statusOptions.filter((item) => item.value)" class="w-full"
        /></UFormField>
        <UFormField name="priority" :label="t('features.serviceRequests.fields.priority')"
          ><USelect v-model="state.priority" :items="priorityOptions.filter((item) => item.value)" class="w-full"
        /></UFormField>
      </div>
      <UFormField name="assignedToId" :label="t('features.serviceRequests.fields.assignedTo')"
        ><USelect v-model="state.assignedToId" :items="userOptions" class="w-full"
      /></UFormField>
      <UFormField
        name="internalNotes"
        :label="t('features.serviceRequests.fields.internalNotes')"
        :description="t('features.serviceRequests.placeholders.internalNotes')"
        ><UTextarea v-model="state.internalNotes" :rows="4" class="w-full"
      /></UFormField>
      <div class="flex justify-end gap-2 border-t border-default pt-4">
        <UButton color="neutral" variant="outline" :disabled="updating" @click="reset">{{ t('common.cancel') }}</UButton
        ><UButton type="submit" :loading="updating">{{ t('features.serviceRequests.actions.saveChanges') }}</UButton>
      </div>
    </UForm>
  </UCard>
</template>
