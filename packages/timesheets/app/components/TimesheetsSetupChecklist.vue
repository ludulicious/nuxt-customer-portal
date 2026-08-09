<script setup lang="ts">
import type { TimesheetsSetupStatusDto } from '@nuxt-customer-portal/timesheets/shared/types/timesheet'

const props = defineProps<{ status: TimesheetsSetupStatusDto }>()
const { t } = useI18n()
const items = computed(() => [
  { complete: props.status.hasClient, key: 'client', to: '/admin/timesheets/clients' },
  { complete: props.status.hasActiveActivity, key: 'activity', to: '/admin/timesheets/activities' },
  { complete: props.status.hasConfiguredProject, key: 'project', to: '/admin/timesheets/projects' },
  {
    complete: props.status.missingDefaultTariffCount === 0,
    key: 'rates',
    to: '/admin/timesheets/rates',
    count: props.status.missingDefaultTariffCount
  }
])
</script>

<template>
  <UAlert color="warning" icon="i-lucide-list-checks" :title="t('features.timesheets.setup.title')" :description="t('features.timesheets.setup.description')" variant="outline">
    <template #actions>
      <ul class="grid w-full gap-2 sm:grid-cols-2">
        <li v-for="item in items" :key="item.key">
          <UButton :to="item.complete ? undefined : item.to" :disabled="item.complete" color="neutral" variant="soft" size="sm" class="w-full justify-start">
            <UIcon :name="item.complete ? 'i-lucide-circle-check' : 'i-lucide-circle-dashed'" :class="item.complete ? 'text-success' : 'text-warning'" />
            {{ t(`features.timesheets.setup.${item.key}`, { count: item.count ?? 0 }) }}
          </UButton>
        </li>
      </ul>
    </template>
  </UAlert>
</template>
