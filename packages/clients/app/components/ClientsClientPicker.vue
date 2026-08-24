<script setup lang="ts">
import type { GenericClientDto } from '@nuxt-customer-portal/clients/shared/types/client'

const props = defineProps<{ modelValue?: string; moduleId?: string; label?: string; required?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { data: clients, status } = await useFetch<GenericClientDto[]>('/api/clients/selectable', {
  query: computed(() => ({ moduleId: props.moduleId }))
})
const items = computed(() => (clients.value ?? []).map((client) => ({ label: client.name, value: client.id })))
</script>

<template>
  <UFormField :label="label" name="clientOrganizationId" :required="required">
    <USelect
      :model-value="modelValue"
      :items="items"
      value-key="value"
      class="w-full"
      size="lg"
      :loading="status === 'pending'"
      @update:model-value="emit('update:modelValue', String($event))"
    />
  </UFormField>
</template>
