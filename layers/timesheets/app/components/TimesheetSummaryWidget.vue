<script setup lang="ts">
const { t } = useI18n()
const { activeOrganizationId } = usePortalSession()
const { bootstrap } = useTimesheets()
const { data, pending, refresh } = await useAsyncData(
  'timesheet-summary-widget',
  () => bootstrap(),
  { watch: [activeOrganizationId] }
)

const totalMinutes = computed(() => data.value?.week.entries.reduce(
  (sum, entry) => sum + entry.durationMinutes,
  0
) ?? 0)
const hours = computed(() => `${Math.floor(totalMinutes.value / 60)}:${String(totalMinutes.value % 60).padStart(2, '0')}`)

watch(activeOrganizationId, () => refresh())
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-semibold">{{ t('features.timesheets.widget.title') }}</h2>
        <UIcon name="i-lucide-clock-3" class="size-5 text-primary" />
      </div>
    </template>
    <div v-if="pending" class="text-sm text-muted">
      {{ t('features.timesheets.loading') }}
    </div>
    <div v-else class="flex items-end justify-between gap-4">
      <div>
        <p class="text-3xl font-semibold tabular-nums">{{ hours }}</p>
        <p class="mt-1 text-sm text-muted">
          {{ t(`features.timesheets.status.${(data?.week.status ?? 'DRAFT').toLowerCase()}`) }}
        </p>
      </div>
      <UButton to="/timesheets" variant="outline" trailing-icon="i-lucide-arrow-right">
        {{ t('features.timesheets.widget.open') }}
      </UButton>
    </div>
  </UCard>
</template>
