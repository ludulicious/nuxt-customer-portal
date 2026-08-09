<script setup lang="ts">
const { t } = useI18n()
const timesheets = useTimesheets()
const { data, pending, refresh } = await useAsyncData('timesheets-internal-approvals', timesheets.internalApprovalQueue)
useSeoMeta({ title: () => t('features.timesheets.internalApprovals.title') })
</script>

<template>
  <TimesheetsPageShell class="h-full min-h-0 space-y-6 overflow-y-auto">
    <header>
      <h1 class="text-2xl font-semibold text-highlighted">{{ t('features.timesheets.internalApprovals.title') }}</h1>
      <p class="mt-1 text-sm text-muted">{{ t('features.timesheets.internalApprovals.subtitle') }}</p>
    </header>
    <div v-if="pending && !data" class="flex justify-center py-12 text-muted" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
    </div>
    <TimesheetsAdminApprovals v-else-if="data" :data="data" :refresh="refresh" />
  </TimesheetsPageShell>
</template>
