<script setup lang="ts">
const { t } = useI18n()
useSeoMeta({ title: () => t('features.timesheets.admin.clientApprovals') })
</script>

<template>
  <TimesheetsPageShell class="flex h-full min-h-0 flex-col gap-4 overflow-y-auto">
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-default pb-4 sm:items-end">
      <div class="flex min-w-0 gap-3">
        <UIcon name="i-lucide-stamp" class="mt-1 size-6 shrink-0 text-primary" />
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold text-highlighted">
            {{ t('features.timesheets.admin.clientApprovals') }}
          </h1>
          <p class="hidden text-sm text-muted sm:block">
            {{ t('features.timesheets.admin.clientApprovalsSubtitle') }}
          </p>
        </div>
      </div>
    </header>
    <TimesheetsReviewRequests />
  </TimesheetsPageShell>
</template>
