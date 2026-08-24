<script setup lang="ts">
const { t } = useI18n()
const capabilities = await $fetch<{ canAccessApprovals: boolean; canEnterTime: boolean; canViewSupplierTime: boolean }>(
  '/api/timesheets/capabilities'
)

if (!capabilities.canViewSupplierTime) {
  await navigateTo(
    capabilities.canEnterTime
      ? '/timesheets'
      : capabilities.canAccessApprovals
        ? '/timesheets/approvals'
        : '/dashboard',
    { replace: true }
  )
}

useSeoMeta({ title: () => t('features.timesheets.suppliers.title') })
</script>

<template>
  <TimesheetsClientTimesheetBrowser mode="view" />
</template>
