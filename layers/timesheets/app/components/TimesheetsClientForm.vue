<script setup lang="ts">
import { z } from 'zod'
import type { TimesheetsAdminBootstrap } from '#layers/timesheets/app/composables/useTimesheets'

export interface TimesheetsClientFormModel {
  mode: 'link' | 'create'
  organizationId: string
  name: string
  slug: string
}

defineProps<{
  data: TimesheetsAdminBootstrap
  busy: boolean
  showCancel: boolean
}>()
const emit = defineEmits<{ submit: [], cancel: [] }>()
const form = defineModel<TimesheetsClientFormModel>({ required: true })
const { t } = useI18n()
const slugWasEdited = ref(false)
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
watch(() => form.value.name, (name) => {
  if (!slugWasEdited.value) form.value.slug = slugify(name)
})
watch(() => form.value.mode, () => {
  slugWasEdited.value = false
})
const schema = computed(() => form.value.mode === 'create'
  ? z.object({
      mode: z.literal('create'),
      name: z.string().trim().min(2, t('features.timesheets.validation.clientNameLength')).max(160),
      slug: z.string().trim().min(1, t('features.timesheets.validation.required')).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, t('features.timesheets.validation.organizationSlugInvalid'))
    })
  : z.object({
      mode: z.literal('link'),
      organizationId: z.string().min(1, t('features.timesheets.validation.required'))
    }))
</script>

<template>
  <UCard>
    <template #header><h2 class="font-semibold">{{ t('features.timesheets.admin.newClient') }}</h2></template>
    <UForm :state="form" :schema="schema" class="space-y-4" @submit="emit('submit')">
      <div class="flex flex-wrap gap-2" role="group" :aria-label="t('features.timesheets.admin.clientOrganizationOption')">
        <UButton type="button" color="neutral" :variant="form.mode === 'link' ? 'solid' : 'outline'" @click="form.mode = 'link'">
          {{ t('features.timesheets.admin.linkExistingOrganization') }}
        </UButton>
        <UButton type="button" color="neutral" :variant="form.mode === 'create' ? 'solid' : 'outline'" @click="form.mode = 'create'">
          {{ t('features.timesheets.admin.createOrganization') }}
        </UButton>
      </div>
      <UFormField v-if="form.mode === 'link'" name="organizationId" :label="t('features.timesheets.admin.organization')" required>
        <USelect
          v-model="form.organizationId"
          :items="data.availableClientOrganizations.map(item => ({ label: item.name, value: item.id }))"
          value-key="value"
          class="w-full"
        />
      </UFormField>
      <p v-if="form.mode === 'link' && !data.availableClientOrganizations.length" class="text-sm text-muted">
        {{ t('features.timesheets.admin.noAvailableClientOrganizations') }}
      </p>
      <template v-if="form.mode === 'create'">
        <UFormField name="name" :label="t('features.timesheets.admin.organizationName')" required>
          <UInput v-model="form.name" class="w-full" />
        </UFormField>
        <UFormField name="slug" :label="t('features.timesheets.admin.organizationSlug')" required>
          <UInput v-model="form.slug" class="w-full" @input="slugWasEdited = true" />
        </UFormField>
      </template>
      <div class="flex justify-end gap-2">
        <UButton v-if="showCancel" type="button" color="neutral" variant="outline" @click="emit('cancel')">
          {{ t('features.timesheets.cancel') }}
        </UButton>
        <UButton type="submit" :loading="busy">
          {{ t(form.mode === 'create' ? 'features.timesheets.admin.createAndLinkClient' : 'features.timesheets.admin.linkClient') }}
        </UButton>
      </div>
    </UForm>
  </UCard>
</template>
