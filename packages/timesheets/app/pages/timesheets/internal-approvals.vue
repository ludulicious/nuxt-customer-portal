<script setup lang="ts">
const { t } = useI18n()
const timesheets = useTimesheets()
const { data, pending, refresh } = await useAsyncData('timesheets-internal-approvals', timesheets.internalApprovalQueue)
useSeoMeta({ title: () => t('features.timesheets.internalApprovals.title') })
</script>

<template>
  <TimesheetsPageShell class="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
    <header class="flex items-center justify-between gap-3 border-b border-default pb-4 sm:items-end">
      <div class="flex min-w-0 gap-3">
        <UIcon name="i-lucide-stamp" class="mt-1 size-6 shrink-0 text-primary" />
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold text-highlighted">
            {{ t('features.timesheets.internalApprovals.title') }}
          </h1>
          <p class="hidden text-sm text-muted sm:block">
            {{ t('features.timesheets.internalApprovals.subtitle') }}
          </p>
        </div>
      </div>
    </header>
    <div v-if="pending && !data" class="flex justify-center py-12 text-muted" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
    </div>
    <TimesheetsAdminApprovals v-else-if="data" :data="data" :refresh="refresh" />
  </TimesheetsPageShell>
</template>
